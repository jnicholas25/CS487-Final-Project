const crypto = require('crypto');
const User = require('../../models/User');
const { AppError } = require('../../middleware/errorHandler');
const { assertNotLocked, recordFailedAttempt, clearLockout } = require('./lockoutService');
const { generateTokenPair } = require('./tokenService');
const { verifyToken, consumeBackupCode } = require('./twoFactorService');
const logger = require('../../utils/logger');

/**
 * Login Service — handles full authentication flow.
 *
 * Algorithm 5.1 mapping:
 *   1. Look up user by email
 *   2. Check account is active and not locked
 *   3. Verify password hash
 *   4. If 2FA enabled: validate OTP or backup code
 *   5. Clear lockout, issue token pair
 *   6. Return tokens + public user data
 */

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register a new user.
 * @param {{ firstName, lastName, email, password, phone? }} data
 * @returns {Promise<{ user: object, tokens: object }>}
 */
async function register({ firstName, lastName, email, password, phone }) {
  // Check for existing account
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError('An account with this email already exists', 409, 'EMAIL_TAKEN');
  }

  // Create user — passwordHash pre-save hook will bcrypt the plain password
  const user = new User({
    firstName,
    lastName,
    email,
    passwordHash: password, // hook hashes this
    phone: phone || null,
  });

  await user.save();
  logger.info(`[Auth] New user registered: ${user.email}`);

  const tokens = generateTokenPair({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { user: sanitizeUser(user), tokens };
}

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Authenticate a user with email + password.
 * If 2FA is enabled the caller must follow up with verifyTwoFactor().
 *
 * @param {{ email, password, ipAddress? }} credentials
 * @returns {Promise<{ requiresTwoFactor: boolean, tempToken?: string, user?: object, tokens?: object }>}
 */
async function login({ email, password, ipAddress }) {
  // 1 — Find user (include passwordHash + lockout for verification)
  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+passwordHash +lockout +twoFactor.enabled +twoFactor.secret +twoFactor.backupCodes');

  if (!user) {
    // Timing-safe: don't reveal whether the email exists
    await simulateHashDelay();
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // 2 — Account checks
  if (!user.isActive) {
    throw new AppError('Account is deactivated. Contact support.', 403, 'ACCOUNT_INACTIVE');
  }

  assertNotLocked(user);

  // 3 — Password check
  const passwordValid = await user.comparePassword(password);
  if (!passwordValid) {
    const { attemptsLeft, isLocked } = await recordFailedAttempt(user._id);
    const message = isLocked
      ? 'Invalid email or password. Account is now locked for 15 minutes.'
      : `Invalid email or password. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`;
    throw new AppError(message, 401, isLocked ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS');
  }

  // 4 — 2FA gate
  if (user.twoFactor.enabled) {
    // Issue a short-lived temp token so the client can complete 2FA
    const tempToken = generateTempToken(user._id.toString());
    return { requiresTwoFactor: true, tempToken };
  }

  // 5 — Success — clear lockout and issue tokens
  await clearLockout(user._id, ipAddress);
  logger.info(`[Auth] Login success: ${user.email}`);

  const tokens = generateTokenPair({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { requiresTwoFactor: false, user: sanitizeUser(user), tokens };
}

// ── 2FA completion ────────────────────────────────────────────────────────────

/**
 * Complete login after passing the 2FA check.
 * @param {{ tempToken, totpCode?, backupCode?, ipAddress? }} params
 * @returns {Promise<{ user: object, tokens: object }>}
 */
async function verifyTwoFactor({ tempToken, totpCode, backupCode, ipAddress }) {
  // Validate temp token
  const userId = verifyTempToken(tempToken);

  const user = await User.findById(userId)
    .select('+twoFactor.secret +twoFactor.backupCodes +twoFactor.enabled');

  if (!user || !user.twoFactor.enabled) {
    throw new AppError('Invalid or expired session', 401, 'INVALID_SESSION');
  }

  let verified = false;

  if (totpCode) {
    verified = verifyToken(user.twoFactor.secret, totpCode);
  } else if (backupCode) {
    verified = await consumeBackupCode(user, backupCode);
  }

  if (!verified) {
    await recordFailedAttempt(user._id);
    throw new AppError('Invalid verification code', 401, 'INVALID_2FA_TOKEN');
  }

  await clearLockout(user._id, ipAddress);
  logger.info(`[Auth] 2FA verified: ${user.email}`);

  const tokens = generateTokenPair({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { user: sanitizeUser(user), tokens };
}

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * Exchange a valid refresh token for a new token pair.
 * @param {string} refreshToken
 * @returns {Promise<{ tokens: object }>}
 */
async function refreshTokens(refreshToken) {
  const { verifyRefreshToken, generateTokenPair: genPair } = require('./tokenService');

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(decoded.sub).select('email role isActive');
  if (!user || !user.isActive) {
    throw new AppError('User not found or inactive', 401, 'USER_NOT_FOUND');
  }

  const tokens = genPair({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { tokens };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Temp token: signed with a derived key, lives for 5 minutes
const TEMP_TOKEN_SECRET = 'temp_2fa_' + (process.env.JWT_SECRET || 'dev');

function generateTempToken(userId) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ sub: userId, type: 'temp_2fa' }, TEMP_TOKEN_SECRET, { expiresIn: '5m' });
}

function verifyTempToken(token) {
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, TEMP_TOKEN_SECRET);
    if (decoded.type !== 'temp_2fa') throw new Error('wrong type');
    return decoded.sub;
  } catch {
    throw new AppError('Invalid or expired 2FA session token', 401, 'INVALID_TEMP_TOKEN');
  }
}

/** Prevent timing attacks by matching the bcrypt delay even on a miss */
async function simulateHashDelay() {
  const bcrypt = require('bcryptjs');
  await bcrypt.hash('timing_safe_placeholder', 12);
}

/**
 * Strip sensitive fields before sending user data to the client.
 * @param {object} user  Mongoose document
 * @returns {object}
 */
function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject({ virtuals: true }) : { ...user };
  delete obj.passwordHash;
  delete obj.twoFactor?.secret;
  delete obj.twoFactor?.backupCodes;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.__v;
  return obj;
}

module.exports = { register, login, verifyTwoFactor, refreshTokens, sanitizeUser };
