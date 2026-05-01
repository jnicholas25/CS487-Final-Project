const crypto = require('crypto');
const User = require('../../models/User');
const { AppError } = require('../../middleware/errorHandler');
const { assertNotLocked, recordFailedAttempt, clearLockout } = require('./lockoutService');
const { generateTokenPair, verifyRefreshToken } = require('./tokenService');
const { verifyToken, consumeBackupCode } = require('./twoFactorService');
const { sendLoginOTP } = require('../notifications/emailService');
const env = require('../../config/environment');
const logger = require('../../utils/logger');

// ── OTP helpers ───────────────────────────────────────────────────────────────

/** Generate a 6-digit numeric OTP */
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** HMAC-SHA256 hash of an OTP with a random salt */
function hashOTP(otp) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', salt).update(otp).digest('hex');
  return { hash, salt };
}

/** Verify an OTP against a stored hash + salt */
function verifyOTPCode(otp, storedHash, salt) {
  if (!otp || !storedHash || !salt) return false;
  const hash = crypto.createHmac('sha256', salt).update(otp.trim()).digest('hex');
  // Constant-time comparison
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

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
  // Gmail-only check
  if (!email.toLowerCase().endsWith('@gmail.com')) {
    throw new AppError('Only Gmail addresses (@gmail.com) are allowed to register', 400, 'GMAIL_REQUIRED');
  }

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

  // 4 — Mandatory 2FA: generate OTP, return temp token immediately, send email in background
  const otp = generateOTP();
  const { hash: otpHash, salt: otpSalt } = hashOTP(otp);

  // Issue temp token BEFORE sending the email so the HTTP response is instant.
  // Email delivery is fire-and-forget — the OTP hash is already signed into the token.
  const tempToken = generateTempToken(user._id.toString(), otpHash, otpSalt);

  // Fire-and-forget: send the email without blocking the response
  sendLoginOTP({ to: user.email, otp, name: user.firstName })
    .then(() => logger.info(`[Auth] OTP emailed to ${user.email}`))
    .catch((emailErr) => logger.error(`[Auth] OTP email failed for ${user.email}: ${emailErr.message}`));

  return { requiresTwoFactor: true, tempToken, otp };
}

// ── 2FA completion ────────────────────────────────────────────────────────────

/**
 * Complete login after passing the 2FA check.
 *
 * Accepts one of:
 *   - emailOtp  — 6-digit code sent to the user's Gmail (mandatory for all users)
 *   - totpCode  — TOTP from an authenticator app (for users who set up TOTP)
 *   - backupCode — one-time backup code (for users who set up TOTP)
 *
 * @param {{ tempToken, emailOtp?, totpCode?, backupCode?, ipAddress? }} params
 * @returns {Promise<{ user: object, tokens: object }>}
 */
async function verifyTwoFactor({ tempToken, emailOtp, totpCode, backupCode, ipAddress }) {
  // Validate temp token — returns full decoded payload including OTP hash
  const decoded = verifyTempToken(tempToken);
  const userId = decoded.sub;

  const user = await User.findById(userId)
    .select('+twoFactor.secret +twoFactor.backupCodes +twoFactor.enabled');

  if (!user) {
    throw new AppError('Invalid or expired session', 401, 'INVALID_SESSION');
  }

  let verified = false;

  if (emailOtp) {
    // Primary path: verify email OTP (available to ALL users)
    verified = verifyOTPCode(emailOtp, decoded.otpHash, decoded.otpSalt);
  } else if (totpCode && user.twoFactor?.enabled) {
    // Alternate path: TOTP for users who have set up an authenticator app
    verified = verifyToken(user.twoFactor.secret, totpCode);
  } else if (backupCode && user.twoFactor?.enabled) {
    // Backup path: one-time backup code for TOTP users
    verified = await consumeBackupCode(user, backupCode);
  } else {
    throw new AppError('Please provide the verification code sent to your Gmail', 400, 'OTP_REQUIRED');
  }

  if (!verified) {
    await recordFailedAttempt(user._id);
    throw new AppError('Invalid verification code. Please check your Gmail and try again.', 401, 'INVALID_2FA_TOKEN');
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

  const tokens = generateTokenPair({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { tokens };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Temp token: signed with a derived key, lives for 5 minutes
const TEMP_TOKEN_SECRET = 'temp_2fa_' + env.JWT_SECRET;

/**
 * Generate a short-lived temp token encoding the OTP hash.
 * @param {string} userId
 * @param {string} [otpHash]  HMAC-SHA256 of the OTP
 * @param {string} [otpSalt]  Salt used in the HMAC
 */
function generateTempToken(userId, otpHash, otpSalt) {
  const jwt = require('jsonwebtoken');
  const payload = { sub: userId, type: 'temp_2fa' };
  if (otpHash) payload.otpHash = otpHash;
  if (otpSalt) payload.otpSalt = otpSalt;
  return jwt.sign(payload, TEMP_TOKEN_SECRET, { expiresIn: '5m' });
}

/**
 * Verify and decode a temp token.
 * @param {string} token
 * @returns {object} Full decoded JWT payload (includes sub, otpHash, otpSalt)
 */
function verifyTempToken(token) {
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, TEMP_TOKEN_SECRET);
    if (decoded.type !== 'temp_2fa') throw new Error('wrong type');
    return decoded; // Return full payload (not just sub)
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
