const { register, login, verifyTwoFactor, refreshTokens } = require('../services/auth/loginService');
const { generateSecret, verifyAndEnable, disable } = require('../services/auth/twoFactorService');
const { AppError } = require('../middleware/errorHandler');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Auth Controller — thin HTTP layer.
 * All business logic lives in loginService / twoFactorService.
 *
 * Routes (defined in authRoutes.js):
 *   POST   /api/v1/auth/register
 *   POST   /api/v1/auth/login
 *   POST   /api/v1/auth/2fa/verify       (complete login after TOTP)
 *   POST   /api/v1/auth/refresh
 *   GET    /api/v1/auth/me               (protected)
 *   POST   /api/v1/auth/2fa/setup        (protected — generate secret + QR)
 *   POST   /api/v1/auth/2fa/enable       (protected — confirm OTP to enable)
 *   DELETE /api/v1/auth/2fa/disable      (protected)
 *   PATCH  /api/v1/auth/password         (protected — change password)
 *   POST   /api/v1/auth/logout           (protected — client clears token)
 */

// ── Registration ──────────────────────────────────────────────────────────────

exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;
    const { user, tokens } = await register({ firstName, lastName, email, password, phone });

    logger.withCorrelation(res.locals.correlationId).info(`[Auth] Registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user, tokens },
    });
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await login({ email, password, ipAddress });

    if (result.requiresTwoFactor) {
      return res.status(200).json({
        success: true,
        requiresTwoFactor: true,
        tempToken: result.tempToken,
        otp: result.otp,           // included so frontend can display as fallback if email fails
        message: 'Please complete two-factor authentication',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: result.user, tokens: result.tokens },
    });
  } catch (err) {
    next(err);
  }
};

// ── 2FA completion ────────────────────────────────────────────────────────────

exports.verifyTwoFactor = async (req, res, next) => {
  try {
    const { tempToken, emailOtp, totpCode, backupCode } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const { user, tokens } = await verifyTwoFactor({ tempToken, emailOtp, totpCode, backupCode, ipAddress });

    res.status(200).json({
      success: true,
      message: 'Two-factor authentication successful',
      data: { user, tokens },
    });
  } catch (err) {
    next(err);
  }
};

// ── Token refresh ─────────────────────────────────────────────────────────────

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const { tokens } = await refreshTokens(refreshToken);

    res.status(200).json({
      success: true,
      message: 'Tokens refreshed',
      data: { tokens },
    });
  } catch (err) {
    next(err);
  }
};

// ── Get current user ──────────────────────────────────────────────────────────

exports.getMe = async (req, res, next) => {
  try {
    // req.user is populated by authMiddleware.protect
    res.status(200).json({
      success: true,
      data: { user: req.user },
    });
  } catch (err) {
    next(err);
  }
};

// ── Update current user profile ──────────────────────────────────────────────

exports.updateMe = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, timezone, currency } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));

    // Only update provided fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName  !== undefined) user.lastName  = lastName;
    if (phone     !== undefined) user.phone     = phone || null;
    if (timezone  !== undefined) user.timezone  = timezone;
    if (currency  !== undefined) user.currency  = currency;

    // Email change — check uniqueness
    if (email !== undefined && email !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
      if (existing) return next(new AppError('That email is already in use', 409, 'EMAIL_TAKEN'));
      user.email = email;
    }

    await user.save();
    logger.info(`[Auth] Profile updated: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

// ── 2FA setup — step 1: generate secret + QR code ────────────────────────────

exports.setup2FA = async (req, res, next) => {
  try {
    if (req.user.twoFactor?.enabled) {
      return next(new AppError('Two-factor authentication is already enabled', 400, 'ALREADY_ENABLED'));
    }

    const { secret, qrCodeDataUrl, otpauthUrl } = await generateSecret(req.user.email);

    res.status(200).json({
      success: true,
      message: 'Scan the QR code with your authenticator app, then confirm with an OTP',
      data: { secret, qrCodeDataUrl, otpauthUrl },
    });
  } catch (err) {
    next(err);
  }
};

// ── 2FA setup — step 2: confirm OTP to enable ────────────────────────────────

exports.enable2FA = async (req, res, next) => {
  try {
    const { secret, token } = req.body;

    // Load user with twoFactor fields selected
    const user = await User.findById(req.user._id).select('+twoFactor.secret +twoFactor.backupCodes');

    const backupCodes = await verifyAndEnable(user, secret, token);

    res.status(200).json({
      success: true,
      message: 'Two-factor authentication enabled',
      data: {
        backupCodes,
        warning: 'Save these backup codes in a safe place. They will not be shown again.',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── 2FA — disable ─────────────────────────────────────────────────────────────

exports.disable2FA = async (req, res, next) => {
  try {
    const { password } = req.body;

    const user = await User.findById(req.user._id).select('+passwordHash +twoFactor');
    if (!user) return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));

    const valid = await user.comparePassword(password);
    if (!valid) return next(new AppError('Incorrect password', 401, 'INVALID_PASSWORD'));

    await disable(user);

    res.status(200).json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (err) {
    next(err);
  }
};

// ── Change password ───────────────────────────────────────────────────────────

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));

    const valid = await user.comparePassword(currentPassword);
    if (!valid) return next(new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD'));

    // Assign to passwordHash — pre-save hook will bcrypt it
    user.passwordHash = newPassword;
    await user.save();

    logger.info(`[Auth] Password changed for user: ${user.email}`);
    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

exports.logout = async (req, res) => {
  // With stateless JWTs the client simply discards the tokens.
  // If refresh token storage is added in future this is where we'd invalidate it.
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};
