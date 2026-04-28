require('dotenv').config();

/**
 * Centralised environment configuration.
 * Validates required variables at startup and exports typed constants.
 * Import this module instead of reading process.env directly throughout the app.
 */

function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key, defaultValue = '') {
  return process.env[key] ?? defaultValue;
}

function optionalInt(key, defaultValue) {
  const raw = process.env[key];
  return raw !== undefined ? parseInt(raw, 10) : defaultValue;
}

function optionalBool(key, defaultValue = false) {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  return raw.toLowerCase() === 'true' || raw === '1';
}

// ── Validation & export ────────────────────────────────────────────────────────

const env = {
  // ── Runtime ─────────────────────────────────────────────────────────────────
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: optionalInt('PORT', 5000),
  CLIENT_URL: optional('CLIENT_URL', 'http://localhost:3000'),
  isProduction: optional('NODE_ENV', 'development') === 'production',
  isDevelopment: optional('NODE_ENV', 'development') === 'development',
  isTest: optional('NODE_ENV', 'development') === 'test',

  // ── MongoDB ──────────────────────────────────────────────────────────────────
  MONGODB_URI: optional('NODE_ENV', 'development') === 'test'
    ? optional('MONGODB_URI_TEST', 'mongodb://localhost:27017/ipfms_test')
    : required('MONGODB_URI'),

  // ── JWT ──────────────────────────────────────────────────────────────────────
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '15m'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),

  // ── Bcrypt ───────────────────────────────────────────────────────────────────
  BCRYPT_SALT_ROUNDS: optionalInt('BCRYPT_SALT_ROUNDS', 12),

  // ── 2FA ──────────────────────────────────────────────────────────────────────
  TOTP_ISSUER: optional('TOTP_ISSUER', 'IPFMS'),
  TOTP_DIGITS: optionalInt('TOTP_DIGITS', 6),
  TOTP_PERIOD: optionalInt('TOTP_PERIOD', 30),

  // ── Encryption ───────────────────────────────────────────────────────────────
  ENCRYPTION_KEY: optional('ENCRYPTION_KEY', ''),

  // ── Email ────────────────────────────────────────────────────────────────────
  SMTP_HOST: optional('SMTP_HOST', ''),
  SMTP_PORT: optionalInt('SMTP_PORT', 587),
  SMTP_SECURE: optionalBool('SMTP_SECURE', false),
  SMTP_USER: optional('SMTP_USER', ''),
  SMTP_PASS: optional('SMTP_PASS', ''),
  EMAIL_FROM: optional('EMAIL_FROM', 'noreply@ipfms.com'),

  // ── SMS ──────────────────────────────────────────────────────────────────────
  TWILIO_ACCOUNT_SID: optional('TWILIO_ACCOUNT_SID', ''),
  TWILIO_AUTH_TOKEN: optional('TWILIO_AUTH_TOKEN', ''),
  TWILIO_PHONE_NUMBER: optional('TWILIO_PHONE_NUMBER', ''),

  // ── Rate Limiting ────────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: optionalInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: optionalInt('RATE_LIMIT_MAX_REQUESTS', 100),
  AUTH_RATE_LIMIT_MAX: optionalInt('AUTH_RATE_LIMIT_MAX', 10),

  // ── Logging ──────────────────────────────────────────────────────────────────
  LOG_LEVEL: optional('LOG_LEVEL', 'info'),
  LOG_DIR: optional('LOG_DIR', 'logs'),
};

module.exports = env;
