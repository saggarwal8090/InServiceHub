# InServiceHub Deployment Guide (PostgreSQL)

This project stores users, Google OAuth identities, password hashes, bookings, providers, and reviews in PostgreSQL.

## Required Environment

Create `server/.env` locally, or set these variables in Render:

```bash
PORT=5001
NODE_ENV=production
JWT_SECRET=change_me_to_a_long_random_secret_string_at_least_32_chars
CLIENT_URL=https://your-production-domain.example
CLIENT_ORIGINS=https://your-production-domain.example
DATABASE_URL=your_render_postgres_external_url
DB_SSL=true
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

For the React app:

```bash
VITE_API_URL=/api
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

## Security Checklist

- Never deploy with the default `JWT_SECRET`; production startup now fails unless it is at least 32 characters.
- Set `CLIENT_URL` or `CLIENT_ORIGINS` to the exact frontend origin. Avoid wildcard CORS in production.
- Run database migrations before traffic so the review uniqueness and booking indexes are present.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. Do not expose it through any `VITE_` variable.

## Android App

The React app is installable as a PWA and includes Capacitor configuration for a native Android shell.

```bash
cd client
npm install
npm run android:add
npm run android:sync
npm run android:open
```

Use Android Studio to build/sign the release APK or AAB after `android:sync`.

## Local Setup

1. Install backend dependencies:

```bash
cd server
npm install
```

2. Initialize the PostgreSQL schema:

```bash
node db/init_postgres.js
```

The server also runs the schema automatically on startup.

3. Optional seed data:

```bash
node seed.js
```

4. Start the server:

```bash
npm start
```

## Render Notes

Use Render's Postgres external URL as `DATABASE_URL`. Render external connections require SSL, so keep `DB_SSL=true` unless you are connecting to a local Docker Postgres instance.
