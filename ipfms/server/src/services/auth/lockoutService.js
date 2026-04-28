const User = require('../../models/User');
const { AppError } = require('../../middleware/errorHandler');

/**
 * Lockout Service — encapsulates brute-force protection logic.
 *
 * Rules (mirrors the User schema):
 *   - 5 consecutive failed login attempts → lock for 15 minutes
 *   - On successful login → reset counters
 *   - On password reset → reset counters
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check whether a user account is currently locked.
 * Throws AppError(423) if locked.
 * @param {import('../../models/User').default} user  Mongoose User document
 */
function assertNotLocked(user) {
  if (user.lockout.lockedUntil && user.lockout.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockout.lockedUntil - Date.now()) / 60000
    );
    throw new AppError(
      `Account is temporarily locked due to too many failed attempts. ` +
        `Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
      423,
      'ACCOUNT_LOCKED'
    );
  }
}

/**
 * Record a failed login attempt for a user and lock if threshold reached.
 * @param {string} userId
 * @returns {Promise<{ attemptsLeft: number, isLocked: boolean }>}
 */
async function recordFailedAttempt(userId) {
  const user = await User.findById(userId).select('+lockout');
  if (!user) return { attemptsLeft: 0, isLocked: false };

  user.lockout.failedAttempts += 1;
  user.lockout.lastFailedAt = new Date();

  const isLocked = user.lockout.failedAttempts >= MAX_ATTEMPTS;
  if (isLocked) {
    user.lockout.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }

  await user.save();

  return {
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - user.lockout.failedAttempts),
    isLocked,
  };
}

/**
 * Clear lockout counters after a successful authentication.
 * Also updates lastLoginAt and lastLoginIp.
 * @param {string} userId
 * @param {string} [ipAddress]
 * @returns {Promise<void>}
 */
async function clearLockout(userId, ipAddress = null) {
  await User.findByIdAndUpdate(userId, {
    $set: {
      'lockout.failedAttempts': 0,
      'lockout.lockedUntil': null,
      'lockout.lastFailedAt': null,
      lastLoginAt: new Date(),
      ...(ipAddress && { lastLoginIp: ipAddress }),
    },
  });
}

module.exports = { assertNotLocked, recordFailedAttempt, clearLockout, MAX_ATTEMPTS };
