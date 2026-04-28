const logger = require('../utils/logger');
const env = require('../config/environment');

/**
 * Normalised API error class.
 * Throw or pass this to next() from anywhere in the app.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Central Express error-handling middleware.
 * Must be registered LAST (after all routes).
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const correlationId = res.locals.correlationId || req.correlationId;
  const log = correlationId ? logger.withCorrelation(correlationId) : logger;

  // ── Mongoose validation error ─────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    log.warn('Mongoose validation error', { details });
    return res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details,
    });
  }

  // ── Mongoose duplicate key ────────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    log.warn('Duplicate key error', { field });
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_KEY',
      message: `A record with this ${field} already exists`,
    });
  }

  // ── Mongoose CastError (bad ObjectId) ────────────────────────────────────
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_ID',
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_EXPIRED',
      message: 'Token has expired',
    });
  }

  // ── Known AppError ────────────────────────────────────────────────────────
  if (err.name === 'AppError') {
    if (err.statusCode >= 500) {
      log.error(err.message, { code: err.code, stack: err.stack });
    } else {
      log.warn(err.message, { code: err.code });
    }
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // ── Unknown / unhandled error ─────────────────────────────────────────────
  log.error('Unhandled error', { message: err.message, stack: err.stack });

  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    // Only expose stack in development
    ...(env.isDevelopment && { stack: err.stack }),
  });
}

module.exports = { errorHandler, AppError };
