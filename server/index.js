const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const jwt = require('jsonwebtoken');

const { OAuth2Client } = require('google-auth-library');
const { initializeDatabase } = require('./db/postgres');
const { supabase } = require('./utils/supabase');

// Vercel handles environment variables automatically. 
// Only load dotenv manually if not running on Vercel.
if (!process.env.VERCEL) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

const app = express();
const port = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : 'development_only_secret_change_before_production_32_chars');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const JWT_ISSUER = 'inservicehub-api';
const JWT_AUDIENCE = 'inservicehub-client';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

if (isProduction && (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET === 'your_jwt_secret')) {
    throw new Error('JWT_SECRET must be set to a strong value of at least 32 characters in production.');
}

// ========== SECURITY MIDDLEWARE ==========

app.disable('x-powered-by');
app.set('trust proxy', 1);

const normalizeOrigins = (...values) => values
    .filter(Boolean)
    .flatMap(value => String(value).split(','))
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean);

const allowedOrigins = normalizeOrigins(
    process.env.CLIENT_ORIGINS,
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    !isProduction ? 'http://localhost:5173,http://localhost:5174,http://localhost:3000' : null
);

const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    const normalizedOrigin = origin.replace(/\/$/, '');

    if (allowedOrigins.includes(normalizedOrigin)) return true;

    return !isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalizedOrigin);
};

// Helmet sets secure HTTP headers.
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "https://accounts.google.com"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "img-src": ["'self'", "data:", "https://ui-avatars.com", "https://lh3.googleusercontent.com"],
            "connect-src": ["'self'", ...allowedOrigins],
            "frame-src": ["'self'", "https://accounts.google.com"],
            "object-src": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
            "upgrade-insecure-requests": isProduction ? [] : null,
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));

// Compression — gzip responses
app.use(compression());

app.use(cors({
    origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 204,
}));

// Rate Limiting — prevent abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: 'Too many login attempts. Please try again later.' },
});

app.use('/api/providers', apiLimiter);
app.use('/api/bookings', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/auth/google', authLimiter);

// JSON parser with size limit
app.use(express.json({ limit: '10kb' }));

// ========== DATABASE ==========

let db;

let dbInstance = null;

async function initDb() {
    if (dbInstance) {
        db = dbInstance; // Sync global db
        return dbInstance;
    }
    try {
        console.log('🔄 Attempting to connect to database...');
        dbInstance = await initializeDatabase();
        db = dbInstance; // Sync global db
        console.log('✅ Database connected successfully');
        return dbInstance;
    } catch (err) {
        console.error('❌ Failed to connect to database:', err);
        dbInstance = null;
        db = null;
        throw err;
    }
}

// Lazy-load DB in middleware or use a helper to get DB
const getDb = async () => {
    await initDb();
    if (!db) throw new Error('Database instance is not initialized');
    return db;
};


// Initial connection attempt (swallow error so server still starts)
initDb().catch(() => {});

// Middleware to ensure DB is connected before handling requests
app.use(async (req, res, next) => {
    if (req.path === '/api/health') return next(); // Skip for health check
    try {
        await initDb();
        next();
    } catch (err) {
        console.error('Database middleware error:', err);
        res.status(500).json({ message: 'Server initialization error. Please try again in a few seconds.' });
    }
});



// ========== AUTH MIDDLEWARE ==========

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Authentication required.' });

    jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE }, (err, user) => {
        if (err || !user?.id || !user?.role) {
            return res.status(403).json({ message: 'Invalid or expired session.' });
        }
        req.user = user;
        next();
    });
};

// ========== AUTH ROUTES ==========

const publicUserFields = `
    id, name, email, phone, role, city, is_online, auth_provider, avatar_url, created_at
`;

const cleanString = (value, maxLength = 255) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
};

const normalizeEmail = (value) => cleanString(value, 320)?.toLowerCase() || null;
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidId = (value) => /^\d+$/.test(String(value));
const parseAmount = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.min(parsed, 100000);
};

const isValidDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isValidTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

function makeAuthResponse(user, extra = {}) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        city: user.city,
        is_online: user.is_online,
        auth_provider: user.auth_provider,
        avatar_url: user.avatar_url,
        ...extra,
    };
}

async function ensureProviderProfile(userId, serviceCategory) {
    const existingDetails = await db.get('SELECT id FROM provider_details WHERE user_id = ?', [userId]);

    if (!existingDetails) {
        await db.run(
            'INSERT INTO provider_details (user_id, service_category) VALUES (?, ?)',
            [userId, serviceCategory || null]
        );
    }

    if (serviceCategory) {
        const existingService = await db.get('SELECT id FROM services WHERE provider_id = ? LIMIT 1', [userId]);

        if (!existingService) {
            await db.run(
                'INSERT INTO services (provider_id, service_name, category, price) VALUES (?, ?, ?, ?)',
                [userId, serviceCategory, 'Home Services', 0]
            );
        }
    }
}

function issueToken(user) {
    return jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN, issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
    );
}

async function verifyGoogleCredential(credential) {
    if (!googleClient || !GOOGLE_CLIENT_ID) {
        const error = new Error('Google OAuth is not configured on the server.');
        error.status = 500;
        throw error;
    }

    const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || payload.email_verified !== true) {
        const error = new Error('Google account email is not verified.');
        error.status = 400;
        throw error;
    }

    return {
        googleId: payload.sub,
        email: payload.email.toLowerCase().trim(),
        name: payload.name || payload.email.split('@')[0],
        avatarUrl: payload.picture || null,
    };
}

app.post('/api/register', async (req, res) => {
    const { password } = req.body;
    const name = cleanString(req.body.name, 120);
    const email = normalizeEmail(req.body.email);
    const role = cleanString(req.body.role, 20);
    const city = cleanString(req.body.city, 100);
    const phone = cleanString(req.body.phone, 30);
    const service_category = cleanString(req.body.service_category, 100);

    try {
        // Input validation
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'Name, email, password, and role are required.' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Enter a valid email address.' });
        }
        if (!['customer', 'provider'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role.' });
        }
        if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
            return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
        }
        if (role === 'provider' && !service_category) {
            return res.status(400).json({ message: 'Service category is required for providers.' });
        }

        const userCheck = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (userCheck) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const newUser = await db.get(
            `INSERT INTO users (name, email, password, role, city, phone, is_online, auth_provider)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING ${publicUserFields}`,
            [name, email, hashedPassword, role, city, phone, role === 'provider', 'password']
        );

        if (role === 'provider') {
            await ensureProviderProfile(newUser.id, service_category);
        }

        const token = issueToken(newUser);
        res.json({ token, user: makeAuthResponse(newUser, { service_category }) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

app.post('/api/login', async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (!user.password) {
            return res.status(400).json({ message: 'This account uses Google sign-in. Sign in with Google first, then set a password from your profile.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = issueToken(user);
        res.json({ token, user: makeAuthResponse(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

app.post('/api/auth/google', async (req, res) => {
    const credential = cleanString(req.body.credential, 5000);
    const role = cleanString(req.body.role, 20) || 'customer';
    const city = cleanString(req.body.city, 100);
    const phone = cleanString(req.body.phone, 30);
    const service_category = cleanString(req.body.service_category, 100);

    try {
        if (!credential) {
            return res.status(400).json({ message: 'Google credential is required.' });
        }

        if (!['customer', 'provider'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role.' });
        }
        if (role === 'provider' && !service_category) {
            return res.status(400).json({ message: 'Service category is required for providers.' });
        }

        const googleProfile = await verifyGoogleCredential(credential);
        let user = await db.get(
            'SELECT * FROM users WHERE google_id = ? OR email = ? LIMIT 1',
            [googleProfile.googleId, googleProfile.email]
        );

        if (user) {
            user = await db.get(
                `UPDATE users
                 SET google_id = COALESCE(google_id, ?),
                     auth_provider = CASE WHEN password IS NULL THEN 'google' ELSE 'both' END,
                     avatar_url = COALESCE(?, avatar_url)
                 WHERE id = ?
                 RETURNING ${publicUserFields}`,
                [googleProfile.googleId, googleProfile.avatarUrl, user.id]
            );
        } else {
            user = await db.get(
                `INSERT INTO users
                    (name, email, password, role, city, phone, is_online, auth_provider, google_id, avatar_url)
                 VALUES (?, ?, NULL, ?, ?, ?, ?, 'google', ?, ?)
                 RETURNING ${publicUserFields}`,
                [
                    googleProfile.name,
                    googleProfile.email,
                    role,
                    city || null,
                    phone || null,
                    role === 'provider',
                    googleProfile.googleId,
                    googleProfile.avatarUrl,
                ]
            );

            if (role === 'provider') {
                await ensureProviderProfile(user.id, service_category);
            }
        }

        const token = issueToken(user);
        res.json({ token, user: makeAuthResponse(user, { service_category }) });
    } catch (err) {
        console.error(err);
        res.status(err.status || 500).json({ message: err.status ? err.message : 'Google sign-in failed. Please try again.' });
    }
});

// ========== PUBLIC ROUTES ==========

app.get('/api/providers', async (req, res) => {
    const city = cleanString(req.query.city, 100);
    const service = cleanString(req.query.service, 100);
    const online = req.query.online;
    try {
        let query = `
        SELECT u.id, u.name, u.city, u.is_online,
               pd.experience, pd.rating, pd.verified, pd.description, pd.total_reviews,
               s.service_name, s.price, s.id as service_id
        FROM users u
        JOIN provider_details pd ON u.id = pd.user_id
        LEFT JOIN services s ON u.id = s.provider_id
        WHERE u.role = 'provider'
      `;
        const params = [];

        if (city) {
            params.push(`%${city}%`);
            query += ` AND u.city ILIKE ?`;
        }
        if (service) {
            params.push(`%${service}%`);
            query += ` AND s.service_name ILIKE ?`;
        }
        if (online === 'true') {
            query += ` AND u.is_online = true`;
        }

        const rows = await db.all(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error.' });
    }
});

app.get('/api/providers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ message: 'Invalid provider id' });

        const providerQuery = `
            SELECT u.id, u.name, u.city, u.is_online,
                   pd.experience, pd.rating, pd.verified, pd.description, pd.total_reviews
            FROM users u
            JOIN provider_details pd ON u.id = pd.user_id
            WHERE u.id = ?
        `;
        const servicesQuery = `SELECT * FROM services WHERE provider_id = ?`;
        const reviewsQuery = `
            SELECT r.rating, r.comment, u.name as reviewer_name
            FROM reviews r
            JOIN bookings b ON r.booking_id = b.id
            JOIN users u ON b.customer_id = u.id
            WHERE b.provider_id = ?
        `;

        const provider = await db.get(providerQuery, [id]);
        if (!provider) return res.status(404).json({ message: 'Provider not found' });

        const services = await db.all(servicesQuery, [id]);
        const reviews = await db.all(reviewsQuery, [id]);

        res.json({ ...provider, services, reviews });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// ========== PROTECTED ROUTES ==========

// GET PROFILE
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await db.get(
            `SELECT id, name, email, phone, role, city, is_online, auth_provider, avatar_url,
                    created_at, password IS NOT NULL as has_password
             FROM users WHERE id = ?`,
            [req.user.id]
        );
        if (!user) return res.status(404).json({ message: 'User not found' });

        let providerDetails = null;
        let service = null;

        if (user.role === 'provider') {
            providerDetails = await db.get(
                'SELECT service_category, experience, description, rating, total_reviews, verified FROM provider_details WHERE user_id = ?',
                [req.user.id]
            );
            service = await db.get(
                'SELECT id, service_name, price FROM services WHERE provider_id = ? LIMIT 1',
                [req.user.id]
            );
        }

        let bookingCount = 0;
        if (user.role === 'customer') {
            const row = await db.get('SELECT COUNT(*) as count FROM bookings WHERE customer_id = ?', [req.user.id]);
            bookingCount = row.count;
        } else if (user.role === 'provider') {
            const row = await db.get('SELECT COUNT(*) as count FROM bookings WHERE provider_id = ?', [req.user.id]);
            bookingCount = row.count;
        }

        res.json({
            ...user,
            providerDetails,
            service,
            bookingCount: Number(bookingCount)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// UPDATE PROFILE
app.put('/api/profile', authenticateToken, async (req, res) => {
    const name = cleanString(req.body.name, 120);
    const phone = cleanString(req.body.phone, 30);
    const city = cleanString(req.body.city, 100);
    const experience = Math.min(Math.max(parseInt(req.body.experience, 10) || 0, 0), 50);
    const price = parseAmount(req.body.price);
    const description = cleanString(req.body.description, 1000);
    const service_name = cleanString(req.body.service_name, 100);

    try {
        if (!name) {
            return res.status(400).json({ message: 'Name is required.' });
        }

        await db.run(
            'UPDATE users SET name = ?, phone = ?, city = ? WHERE id = ?',
            [name, phone, city, req.user.id]
        );

        if (req.user.role === 'provider') {
            await db.run(
                'UPDATE provider_details SET experience = ?, description = ? WHERE user_id = ?',
                [experience || 0, description || null, req.user.id]
            );

            const existingService = await db.get('SELECT id FROM services WHERE provider_id = ? LIMIT 1', [req.user.id]);
            if (existingService) {
                await db.run(
                    'UPDATE services SET price = ?, service_name = ? WHERE id = ?',
                    [price || 0, service_name || null, existingService.id]
                );
            }
        }

        const updatedUser = await db.get(
            `SELECT ${publicUserFields} FROM users WHERE id = ?`,
            [req.user.id]
        );

        res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// CHANGE PASSWORD
app.put('/api/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const user = await db.get('SELECT password, google_id FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
            return res.status(400).json({ message: 'New password must be between 8 and 128 characters' });
        }

        if (user.password) {
            const isMatch = await bcrypt.compare(currentPassword || '', user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }
        }

        const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await db.run(
            `UPDATE users
             SET password = ?,
                 auth_provider = CASE WHEN google_id IS NULL THEN 'password' ELSE 'both' END
             WHERE id = ?`,
            [hashed, req.user.id]
        );

        res.json({ message: user.password ? 'Password changed successfully' : 'Password set successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// Toggle Online Status (Provider only)
app.put('/api/toggle-online', authenticateToken, async (req, res) => {
    if (req.user.role !== 'provider') return res.status(403).json({ message: 'Access denied' });
    try {
        const row = await db.get(
            'UPDATE users SET is_online = NOT is_online WHERE id = ? RETURNING is_online',
            [req.user.id]
        );
        res.json({ is_online: row.is_online });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// BROADCAST BOOKING
app.post('/api/bookings', authenticateToken, async (req, res) => {
    const provider_id = req.body.provider_id;
    const service_id = req.body.service_id;
    const service_type = cleanString(req.body.service_type, 100);
    const city = cleanString(req.body.city, 100);
    const date = cleanString(req.body.date, 10);
    const time = cleanString(req.body.time, 5);
    const address = cleanString(req.body.address, 500);
    const description = cleanString(req.body.description, 1000);

    try {
        if (req.user.role !== 'customer') {
            return res.status(403).json({ message: 'Only customers can create bookings.' });
        }
        if (!date || !time || !address || !isValidDate(date) || !isValidTime(time)) {
            return res.status(400).json({ message: 'Date, time, and address are required.' });
        }

        if (provider_id) {
            if (!isValidId(provider_id) || (service_id && !isValidId(service_id))) {
                return res.status(400).json({ message: 'Invalid provider or service.' });
            }

            const provider = await db.get('SELECT id, city FROM users WHERE id = ? AND role = ?', [provider_id, 'provider']);
            if (!provider) {
                return res.status(400).json({ message: 'Selected provider is not available.' });
            }

            if (service_id) {
                const service = await db.get('SELECT id FROM services WHERE id = ? AND provider_id = ?', [service_id, provider_id]);
                if (!service) {
                    return res.status(400).json({ message: 'Selected service is not available.' });
                }
            }

            const newBooking = await db.get(
                'INSERT INTO bookings (customer_id, provider_id, service_id, date, time, address, description, service_type, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
                [req.user.id, provider_id, service_id || null, date, time, address, description, service_type, city || provider.city]
            );
            res.json(newBooking);
        } else {
            if (!service_type || !city) {
                return res.status(400).json({ message: 'City and service type are required for broadcast requests.' });
            }

            const newBooking = await db.get(
                'INSERT INTO bookings (customer_id, provider_id, service_id, date, time, address, description, service_type, city, status) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
                [req.user.id, date, time, address, description, service_type, city, 'pending']
            );
            res.json(newBooking);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// GET BOOKING REQUESTS (provider)
app.get('/api/booking-requests', authenticateToken, async (req, res) => {
    if (req.user.role !== 'provider') return res.status(403).json({ message: 'Access denied' });
    try {
        const provider = await db.get(`
            SELECT u.city, s.service_name
            FROM users u
            LEFT JOIN services s ON u.id = s.provider_id
            WHERE u.id = ?
        `, [req.user.id]);

        if (!provider?.city || !provider?.service_name) return res.json([]);

        const requests = await db.all(`
            SELECT b.*, u.name as customer_name, u.phone as customer_phone
            FROM bookings b
            JOIN users u ON b.customer_id = u.id
            WHERE b.provider_id IS NULL
              AND b.status = 'pending'
              AND LOWER(b.city) = LOWER(?)
              AND LOWER(b.service_type) = LOWER(?)
            ORDER BY b.created_at DESC
        `, [provider.city, provider.service_name]);

        res.json(requests);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// ACCEPT A BOOKING REQUEST
app.put('/api/bookings/:id/accept', authenticateToken, async (req, res) => {
    if (req.user.role !== 'provider') return res.status(403).json({ message: 'Access denied' });
    const { id } = req.params;
    try {
        if (!isValidId(id)) {
            return res.status(400).json({ message: 'Invalid booking id.' });
        }

        const provider = await db.get(`
            SELECT u.city, s.id as service_id, s.service_name
            FROM users u
            LEFT JOIN services s ON u.id = s.provider_id
            WHERE u.id = ?
            LIMIT 1
        `, [req.user.id]);

        if (!provider?.city || !provider?.service_name) {
            return res.status(400).json({ message: 'Complete your city and service profile before accepting requests.' });
        }

        const updated = await db.get(
            `UPDATE bookings
             SET provider_id = ?, service_id = ?, status = ?
             WHERE id = ?
               AND provider_id IS NULL
               AND status = ?
               AND LOWER(city) = LOWER(?)
               AND LOWER(service_type) = LOWER(?)
             RETURNING *`,
            [req.user.id, provider.service_id || null, 'accepted', id, 'pending', provider.city, provider.service_name]
        );

        if (!updated) {
            return res.status(400).json({ message: 'This request is no longer available.' });
        }

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// Get Bookings (For both Customer and Provider)
app.get('/api/my-bookings', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'customer') {
            const rows = await db.all(`
                SELECT b.*,
                       u.name as provider_name,
                       u.phone as provider_phone,
                       u.city as provider_city,
                       pd.rating as provider_rating,
                       pd.experience as provider_experience,
                       s.service_name,
                       s.price
                FROM bookings b
                LEFT JOIN users u ON b.provider_id = u.id
                LEFT JOIN provider_details pd ON b.provider_id = pd.user_id
                LEFT JOIN services s ON b.service_id = s.id
                WHERE b.customer_id = ?
                ORDER BY b.created_at DESC
            `, [req.user.id]);
            return res.json(rows);
        } else if (req.user.role === 'provider') {
            const rows = await db.all(`
                SELECT b.*, u.name as customer_name, u.phone as customer_phone, s.service_name, s.price
                FROM bookings b
                JOIN users u ON b.customer_id = u.id
                LEFT JOIN services s ON b.service_id = s.id
                WHERE b.provider_id = ?
                ORDER BY b.created_at DESC
            `, [req.user.id]);
            return res.json(rows);
        } else {
            const rows = await db.all(`SELECT * FROM bookings ORDER BY created_at DESC`);
            return res.json(rows);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// Update Booking Status
app.put('/api/bookings/:id/status', authenticateToken, async (req, res) => {
    const status = cleanString(req.body.status, 20);
    const { id } = req.params;

    if (!isValidId(id)) {
        return res.status(400).json({ message: 'Invalid booking id.' });
    }
    if (!['pending', 'accepted', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status.' });
    }

    try {
        const booking = await db.get('SELECT id, customer_id, provider_id, status FROM bookings WHERE id = ?', [id]);
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        const isProviderOwner = req.user.role === 'provider' && Number(booking.provider_id) === Number(req.user.id);
        const isCustomerOwner = req.user.role === 'customer' && Number(booking.customer_id) === Number(req.user.id);
        const isAdmin = req.user.role === 'admin';

        if (!isProviderOwner && !isCustomerOwner && !isAdmin) {
            return res.status(403).json({ message: 'Access denied' });
        }
        if (booking.status === 'completed' && status !== 'completed' && !isAdmin) {
            return res.status(400).json({ message: 'Completed bookings cannot be changed.' });
        }
        if (isCustomerOwner && status !== 'cancelled') {
            return res.status(403).json({ message: 'Customers can only cancel their own bookings.' });
        }
        if (isProviderOwner && !['accepted', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Invalid provider status transition.' });
        }

        const updated = await db.get('UPDATE bookings SET status = ? WHERE id = ? RETURNING *', [status, id]);
        res.json({ message: 'Status updated', booking: updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// Add Review
app.post('/api/reviews', authenticateToken, async (req, res) => {
    const booking_id = req.body.booking_id;
    const rating = Number(req.body.rating);
    const comment = cleanString(req.body.comment, 1000);
    try {
        if (!isValidId(booking_id)) {
            return res.status(400).json({ message: 'Invalid booking.' });
        }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
        }

        const booking = await db.get('SELECT * FROM bookings WHERE id = ? AND customer_id = ?', [booking_id, req.user.id]);
        if (!booking) return res.status(400).json({ message: 'Invalid booking' });
        if (booking.status !== 'completed') {
            return res.status(400).json({ message: 'You can review only completed bookings.' });
        }

        const existingReview = await db.get('SELECT id FROM reviews WHERE booking_id = ?', [booking_id]);
        if (existingReview) {
            return res.status(400).json({ message: 'This booking has already been reviewed.' });
        }

        await db.run(
            'INSERT INTO reviews (booking_id, rating, comment) VALUES (?, ?, ?)',
            [booking_id, rating, comment]
        );

        // Update provider's average rating
        if (booking.provider_id) {
            const avgResult = await db.get(`
                SELECT AVG(r.rating) as avg_rating, COUNT(r.id) as total_reviews
                FROM reviews r
                JOIN bookings b ON r.booking_id = b.id
                WHERE b.provider_id = ?
            `, [booking.provider_id]);

            if (avgResult) {
                await db.run(
                    'UPDATE provider_details SET rating = ?, total_reviews = ? WHERE user_id = ?',
                    [Math.round(avgResult.avg_rating * 100) / 100, avgResult.total_reviews, booking.provider_id]
                );
            }
        }

        res.json({ message: 'Review added' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    let supabaseStatus = supabase ? 'unknown' : 'not_configured';
    if (supabase) {
        try {
            const { error } = await supabase.from('users').select('id').limit(1);
            supabaseStatus = error ? 'error' : 'ok';
        } catch (err) {
            supabaseStatus = 'error';
        }
    }

    res.json({ 
        status: 'ok', 
        version: 'supabase-v1',
        supabase: supabaseStatus,
        timestamp: new Date().toISOString() 
    });
});

// GET PLATFORM STATS
app.get('/api/stats/dashboard', async (req, res) => {
    try {
        const providerCount = await db.get("SELECT COUNT(*) as count FROM users WHERE role = 'provider'");
        const customerCount = await db.get("SELECT COUNT(*) as count FROM users WHERE role = 'customer'");
        const bookingCount = await db.get("SELECT COUNT(*) as count FROM bookings");
        const cityCount = await db.get("SELECT COUNT(DISTINCT city) as count FROM users WHERE city IS NOT NULL");
        const avgRating = await db.get("SELECT AVG(rating) as avg FROM provider_details WHERE rating > 0");

        res.json({
            providers: Number(providerCount.count),
            customers: Number(customerCount.count),
            bookings: Number(bookingCount.count),
            cities: Number(cityCount.count),
            rating: Number(avgRating.avg || 0).toFixed(1)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching stats' });
    }
});


// ========== STATIC FILES (PRODUCTION) ==========

if (!process.env.VERCEL) {
    const clientDistPath = path.resolve(__dirname, '../client/dist');
    const indexPath = path.join(clientDistPath, 'index.html');

    // Serve static assets with aggressive caching (JS/CSS have hashed filenames)
    app.use(express.static(clientDistPath, {
        maxAge: isProduction ? '7d' : 0,
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
            // Cache hashed assets forever, but HTML files should revalidate
            if (filePath.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-cache');
            }
        },
    }));

    // SPA catch-all for client-side routing
    // Only serve index.html for navigation requests (not for API routes or static assets)
    app.use((req, res, next) => {
        // Skip if not a GET request or doesn't accept HTML
        if (req.method !== 'GET' || !req.accepts('html')) return next();
        
        // Skip API-only paths (these are never frontend routes)
        const apiOnlyPaths = ['/api/', '/providers', '/toggle-online', '/my-bookings', 
                              '/booking-requests'];
        if (apiOnlyPaths.some(p => req.path.startsWith(p))) return next();
        
        // Skip static asset files (anything with a file extension)
        if (req.path.includes('.') || req.path.startsWith('/assets/') || req.path.startsWith('/images/')) return next();
        
        // Serve index.html for all other routes (React Router handles them)
        // This includes /login, /register, /search, /profile, /bookings, etc.
        if (fs.existsSync(indexPath)) {
            return res.sendFile(indexPath);
        }
        next();
    });
}

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ message: 'Origin is not allowed.' });
    }
    if (isProduction) {
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    } else {
        res.status(500).json({ message: err.message, stack: err.stack });
    }
});

if (require.main === module) {
    const server = app.listen(port, () => {
        console.log(`\n🚀 Server running on port ${port} [${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
        console.log(`   Frontend: http://localhost:${port}`);
        if (!isProduction) {
            console.log(`   API: http://localhost:${port}/api/health`);
        }
        console.log('');
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
        console.log(`\n${signal} received. Shutting down gracefully...`);
        server.close(() => {
            console.log('HTTP server closed.');
            if (db) {
                db.close().then(() => {
                    console.log('Database connection closed.');
                    process.exit(0);
                }).catch(() => process.exit(1));
            } else {
                process.exit(0);
            }
        });
        // Force close after 10 seconds
        setTimeout(() => {
            console.error('Forcing shutdown...');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
