const rateLimit = require('express-rate-limit');
const env = require('../config/environment');

/**
 * Generic API rate limiter — applied globally to all routes.
 * 100 requests per 15-minute window per IP (configurable via env).
 */
const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,   // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests — please try again later.',
  },
});

/**
 * Strict limiter for authentication endpoints.
 * 10 attempts per 15-minute window per IP to slow brute-force attacks.
 */
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // don't count successful logins toward the limit
  message: {
    success: false,
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts — please try again in 15 minutes.',
  },
});

module.exports = { apiLimiter, authLimiter };
