/**
 * Error Middleware
 * Centralized error handling — never leaks stack traces in production
 */

'use strict';

const logger = require('../utils/logger');

/**
 * AppError — operational errors (4xx, known 5xx)
 * Use this for all predictable, handleable errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true; // Distinguish from programmer errors
    this.errors = errors; // Validation error array
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 handler — must be registered AFTER all routes
 */
const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

/**
 * Global error handler — must be registered LAST with 4 args
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err, message: err.message, stack: err.stack };

  // ── Mongoose: Bad ObjectId ───────────────────────────────────────────────
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    error = new AppError(`Invalid ID format: ${err.value}`, 400);
  }

  // ── Mongoose: Duplicate key ──────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field];
    error = new AppError(`Duplicate value: ${field} '${value}' already exists.`, 409);
  }

  // ── Mongoose: Validation errors ──────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new AppError('Validation failed', 422, messages);
  }

  // ── JWT errors ───────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired.', 401);
  }

  // ── CORS ─────────────────────────────────────────────────────────────────
  if (err.message?.includes('CORS')) {
    error = new AppError(err.message, 403);
  }

  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Log server errors
  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} — ${statusCode} — ${err.message}`, {
      stack: err.stack,
      user: req.user?._id,
    });
  }

  res.status(statusCode).json({
    success: false,
    status: error.status || 'error',
    message: error.message || 'Internal server error',
    ...(error.errors && { errors: error.errors }),
    // Only expose stack trace in development
    ...(!isProduction && statusCode >= 500 && { stack: err.stack }),
  });
};

module.exports = { AppError, notFound, errorHandler };
