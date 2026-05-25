'use strict';

const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const morgan         = require('morgan');
const rateLimit      = require('express-rate-limit');
const mongoSanitize  = require('express-mongo-sanitize');
const hpp            = require('hpp');
const compression    = require('compression');
const cookieParser   = require('cookie-parser');

const errorHandler    = require('./middleware/errorHandler');
const notFound        = require('./middleware/notFound');
const logger          = require('./utils/logger');

const authRoutes      = require('./routes/authRoutes');
const leadRoutes      = require('./routes/leadRoutes');
const noteRoutes      = require('./routes/noteRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();

// ── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      scriptSrc:  ["'self'"],
      imgSrc:     ["'self'", 'data:'],
    },
  },
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS policy: origin ' + origin + ' not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ── Sanitization ─────────────────────────────────────────────────────────────
app.use(mongoSanitize());
app.use(hpp());

// ── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ── Request Logging ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip:   (req) => req.url === '/api/health',
  }));
}

// ── Global Rate Limiter ───────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api/', globalLimiter);

// ── Auth Rate Limiter ─────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status:  'healthy',
    env:     process.env.NODE_ENV,
    uptime:  process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/leads',     leadRoutes);
app.use('/api/leads',     noteRoutes);
app.use('/api/analytics', analyticsRoutes);

// ── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
