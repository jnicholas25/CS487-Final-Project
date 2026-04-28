const { TOTP, Secret } = require('otpauth');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const env = require('../../config/environment');
const { AppError } = require('../../middleware/errorHandler');

/**
 * Two-Factor Authentication Service (TOTP — RFC 6238).
 *
 * Flow:
 *   1. User requests 2FA setup → generateSecret() → show QR code + secret
 *   2. User scans QR code with authenticator app, enters first OTP
 *   3. verifyAndEnable() confirms OTP, stores secret, enables 2FA
 *   4. On subsequent logins verifyToken() checks the OTP
 *   5. Backup codes let users bypass TOTP if they lose their device
 */

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_LENGTH = 10; // characters

// ── TOTP helpers ─────────────────────────────────────────────────────────────

/**
 * Create a new TOTP instance from a base32 secret string.
 * @param {string} secret  base32-encoded secret
 * @returns {TOTP}
 */
function createTotp(secret) {
  return new TOTP({
    issuer: env.TOTP_ISSUER,
    algorithm: 'SHA1',
    digits: env.TOTP_DIGITS,
    period: env.TOTP_PERIOD,
    secret: Secret.fromBase32(secret),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

/**
 * Generate a fresh TOTP secret and QR code URI for display to the user.
 * The secret is NOT yet stored — call verifyAndEnable() to persist it.
 *
 * @param {string} userEmail  Used as the account label in the QR code
 * @returns {Promise<{ secret: string, qrCodeDataUrl: string, otpauthUrl: string }>}
 */
async function generateSecret(userEmail) {
  const secret = new Secret({ size: 20 }); // 160-bit random secret

  const totp = new TOTP({
    issuer: env.TOTP_ISSUER,
    label: userEmail,
    algorithm: 'SHA1',
    digits: env.TOTP_DIGITS,
    period: env.TOTP_PERIOD,
    secret,
  });

  const otpauthUrl = totp.toString();
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return {
    secret: secret.base32,       // store this temporarily in session
    qrCodeDataUrl,
    otpauthUrl,
  };
}

/**
 * Verify a submitted OTP against a secret (before enabling 2FA).
 * @param {string} secret   base32-encoded TOTP secret
 * @param {string} token    6-digit OTP from authenticator app
 * @returns {boolean}
 */
function verifyToken(secret, token) {
  const totp = createTotp(secret);
  // delta: allow ±1 period window to tolerate clock skew
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

/**
 * Verify an OTP and persist the 2FA secret on the user document.
 * Generates and returns backup codes.
 *
 * @param {object} user    Mongoose User document (must have twoFactor field)
 * @param {string} secret  base32-encoded secret from generateSecret()
 * @param {string} token   OTP the user just entered to confirm setup
 * @returns {Promise<string[]>} plain-text backup codes (show once, never again)
 */
async function verifyAndEnable(user, secret, token) {
  if (!verifyToken(secret, token)) {
    throw new AppError('Invalid verification code', 400, 'INVALID_2FA_TOKEN');
  }

  const { plainCodes, hashedCodes } = await generateBackupCodes();

  user.twoFactor.enabled = true;
  user.twoFactor.secret = secret;
  user.twoFactor.backupCodes = hashedCodes;
  user.twoFactor.verifiedAt = new Date();

  await user.save();

  return plainCodes; // return once — user must save them
}

/**
 * Disable 2FA on a user document.
 * @param {object} user  Mongoose User document
 */
async function disable(user) {
  user.twoFactor.enabled = false;
  user.twoFactor.secret = undefined;
  user.twoFactor.backupCodes = [];
  user.twoFactor.verifiedAt = undefined;
  await user.save();
}

// ── Backup codes ─────────────────────────────────────────────────────────────

/**
 * Generate a set of backup codes.
 * @returns {Promise<{ plainCodes: string[], hashedCodes: string[] }>}
 */
async function generateBackupCodes() {
  const plainCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(Math.ceil(BACKUP_CODE_LENGTH / 2))
      .toString('hex')
      .slice(0, BACKUP_CODE_LENGTH)
      .toUpperCase()
  );

  const hashedCodes = await Promise.all(
    plainCodes.map((code) => bcrypt.hash(code, 10))
  );

  return { plainCodes, hashedCodes };
}

/**
 * Attempt to consume a backup code.
 * Removes the used code from the stored list.
 *
 * @param {object} user  Mongoose User document (select +twoFactor.backupCodes)
 * @param {string} code  Plain-text backup code entered by the user
 * @returns {Promise<boolean>} true if a matching code was found and consumed
 */
async function consumeBackupCode(user, code) {
  const candidates = user.twoFactor.backupCodes || [];
  const normalised = code.toUpperCase().replace(/[^A-Z0-9]/g, '');

  for (let i = 0; i < candidates.length; i++) {
    const match = await bcrypt.compare(normalised, candidates[i]);
    if (match) {
      // Remove the used code
      user.twoFactor.backupCodes.splice(i, 1);
      await user.save();
      return true;
    }
  }
  return false;
}

module.exports = {
  generateSecret,
  verifyToken,
  verifyAndEnable,
  disable,
  generateBackupCodes,
  consumeBackupCode,
};
