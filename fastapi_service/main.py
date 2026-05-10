"""
InServiceHub FastAPI Service
Provides analytics, recommendations, and health-check endpoints.
Works alongside the Node.js (Express) server.
"""

from decimal import Decimal
from typing import AsyncGenerator, List, Optional
from urllib.parse import urlparse
import os
from dotenv import load_dotenv


import asyncpg
from fastapi import Depends, FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load environment variables from root .env
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

IS_PRODUCTION = (os.getenv("NODE_ENV") or os.getenv("ENVIRONMENT") or "").lower() == "production"


app = FastAPI(
    title="InServiceHub API",
    description="FastAPI micro-service for analytics & recommendations",
    version="1.0.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
)

def configured_origins() -> List[str]:
    origins = os.getenv("CLIENT_ORIGINS") or os.getenv("CLIENT_URL") or os.getenv("FRONTEND_URL")
    if origins:
        return [origin.strip().rstrip("/") for origin in origins.split(",") if origin.strip()]
    if IS_PRODUCTION:
        return []
    return ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"]


CORS_ORIGINS = configured_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=bool(CORS_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)

LOCAL_DB_HOSTS = {"localhost", "127.0.0.1", "::1", "postgres"}

DATABASE_URL = os.getenv("DATABASE_URL")


def use_ssl() -> bool:
    explicit = (os.getenv("DB_SSL") or os.getenv("PGSSLMODE") or "").lower()

    if explicit in {"false", "0", "disable", "disabled", "no"}:
        return False
    if explicit in {"true", "1", "require", "required", "yes"}:
        return True
    if not DATABASE_URL:
        return False

    host = urlparse(DATABASE_URL).hostname
    return host not in LOCAL_DB_HOSTS


def database_config() -> dict:
    ssl = use_ssl()

    if DATABASE_URL:
        return {"dsn": DATABASE_URL, "ssl": ssl}

    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "database": os.getenv("DB_NAME", "inservicehub"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", "password"),
        "ssl": ssl,
    }


@app.on_event("startup")
async def startup() -> None:
    app.state.pool = await asyncpg.create_pool(
        min_size=1,
        max_size=int(os.getenv("DB_POOL_MAX", "10")),
        **database_config(),
    )


@app.on_event("shutdown")
async def shutdown() -> None:
    pool = getattr(app.state, "pool", None)
    if pool:
        await pool.close()


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = getattr(app.state, "pool", None)
    if not pool:
        raise HTTPException(status_code=503, detail="Database is not connected")

    async with pool.acquire() as connection:
        yield connection


def row_to_dict(row: asyncpg.Record) -> dict:
    data = dict(row)
    for key, value in data.items():
        if isinstance(value, Decimal):
            data[key] = float(value)
    return data


class ProviderOut(BaseModel):
    id: int
    name: str
    city: Optional[str]
    is_online: bool
    service_category: Optional[str]
    experience: Optional[int]
    rating: Optional[float]
    total_reviews: Optional[int]
    verified: Optional[bool]


class CategoryStats(BaseModel):
    category: str
    provider_count: int
    avg_rating: float


class HealthResponse(BaseModel):
    status: str
    database: str
    version: str


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint."""
    try:
        pool = getattr(app.state, "pool", None)
        if not pool:
            raise RuntimeError("Database pool is not initialized")
        async with pool.acquire() as connection:
            await connection.fetchval("SELECT 1")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return HealthResponse(status="ok", database=db_status, version="1.0.0")


@app.get("/api/categories", response_model=List[CategoryStats], tags=["Analytics"])
async def category_stats(db: asyncpg.Connection = Depends(get_db)):
    """Return the number of providers and average rating per service category."""
    rows = await db.fetch(
        """
        SELECT
            pd.service_category AS category,
            COUNT(*)::int AS provider_count,
            COALESCE(ROUND(AVG(pd.rating), 2), 0)::float AS avg_rating
        FROM provider_details pd
        WHERE pd.service_category IS NOT NULL
        GROUP BY pd.service_category
        ORDER BY provider_count DESC
        """
    )
    return [row_to_dict(row) for row in rows]


@app.get("/api/providers/top", response_model=List[ProviderOut], tags=["Providers"])
async def top_providers(
    limit: int = Query(10, ge=1, le=50),
    city: Optional[str] = Query(None, max_length=100),
    category: Optional[str] = Query(None, max_length=100),
    db: asyncpg.Connection = Depends(get_db),
):
    """Return top-rated providers, optionally filtered by city or category."""
    query = """
        SELECT u.id, u.name, u.city, u.is_online,
               pd.service_category, pd.experience, pd.rating,
               pd.total_reviews, pd.verified
        FROM users u
        JOIN provider_details pd ON u.id = pd.user_id
        WHERE u.role = 'provider'
    """
    params = []

    if city:
        params.append(f"%{city}%")
        query += f" AND u.city ILIKE ${len(params)}"
    if category:
        params.append(f"%{category}%")
        query += f" AND pd.service_category ILIKE ${len(params)}"

    params.append(limit)
    query += f" ORDER BY pd.rating DESC LIMIT ${len(params)}"

    rows = await db.fetch(query, *params)
    return [row_to_dict(row) for row in rows]


@app.get("/api/providers/{provider_id}", tags=["Providers"])
async def provider_detail(provider_id: int = Path(..., ge=1), db: asyncpg.Connection = Depends(get_db)):
    """Get detailed provider information including services and reviews."""
    provider = await db.fetchrow(
        """
        SELECT u.id, u.name, u.city, u.is_online,
               pd.service_category, pd.experience, pd.rating,
               pd.total_reviews, pd.verified, pd.description
        FROM users u
        JOIN provider_details pd ON u.id = pd.user_id
        WHERE u.id = $1 AND u.role = 'provider'
        """,
        provider_id,
    )

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    services = await db.fetch(
        "SELECT id, service_name, category, price FROM services WHERE provider_id = $1",
        provider_id,
    )
    reviews = await db.fetch(
        """
        SELECT r.rating, r.comment, u.name AS reviewer_name
        FROM reviews r
        JOIN bookings b ON r.booking_id = b.id
        JOIN users u ON b.customer_id = u.id
        WHERE b.provider_id = $1
        """,
        provider_id,
    )

    return {
        **row_to_dict(provider),
        "services": [row_to_dict(row) for row in services],
        "reviews": [row_to_dict(row) for row in reviews],
    }


@app.get("/api/stats/dashboard", tags=["Analytics"])
async def dashboard_stats(db: asyncpg.Connection = Depends(get_db)):
    """Platform-wide statistics for an admin dashboard."""
    total_providers = await db.fetchval("SELECT COUNT(*)::int FROM users WHERE role = 'provider'")
    total_customers = await db.fetchval("SELECT COUNT(*)::int FROM users WHERE role = 'customer'")
    total_bookings = await db.fetchval("SELECT COUNT(*)::int FROM bookings")
    total_reviews = await db.fetchval("SELECT COUNT(*)::int FROM reviews")
    avg_rating = await db.fetchval(
        "SELECT COALESCE(ROUND(AVG(rating), 2), 0)::float FROM provider_details WHERE rating > 0"
    )

    return {
        "total_providers": total_providers,
        "total_customers": total_customers,
        "total_bookings": total_bookings,
        "total_reviews": total_reviews,
        "avg_platform_rating": float(avg_rating or 0),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
