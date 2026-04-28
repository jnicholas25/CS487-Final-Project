const jwt = require('jsonwebtoken');
const env = require('../../config/environment');

/**
 * Token Service — manages JWT access tokens and refresh tokens.
 *
 * Access token:  short-lived (15 min default), sent in Authorization header
 * Refresh token: long-lived (7 days default), used to obtain a new access token
 */

/**
 * Generate a short-lived JWT access token.
 * @param {object} payload   Must include { userId, email, role }
 * @returns {string}
 */
function generateAccessToken(payload) {
  return jwt.sign(
    {
      sub: payload.userId,
      email: payload.email,
      role: payload.role,
      type: 'access',
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Generate a long-lived JWT refresh token.
 * @param {object} payload   Must include { userId }
 * @returns {string}
 */
function generateRefreshToken(payload) {
  return jwt.sign(
    {
      sub: payload.userId,
      type: 'refresh',
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
}

/**
 * Verify and decode an access token.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyAccessToken(token) {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

/**
 * Verify and decode a refresh token.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

/**
 * Extract the raw token string from an Authorization header value.
 * Accepts "Bearer <token>" format.
 * @param {string|undefined} authHeader
 * @returns {string|null}
 */
function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * Generate both access and refresh tokens for a user payload.
 * @param {object} payload  { userId, email, role }
 * @returns {{ accessToken: string, refreshToken: string, expiresIn: string }}
 */
function generateTokenPair(payload) {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    expiresIn: env.JWT_EXPIRES_IN,
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractBearerToken,
  generateTokenPair,
};
