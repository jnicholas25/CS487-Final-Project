const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  validate,
  registerRules,
  loginRules,
  twoFactorVerifyRules,
  twoFactorSetupVerifyRules,
  refreshTokenRules,
  changePasswordRules,
} = require('../validators/authValidator');
const { body } = require('express-validator');

// ── Public routes (no token required) ────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Register a new user account.
 */
router.post(
  '/register',
  authLimiter,
  registerRules,
  validate,
  authController.register
);

/**
 * POST /api/v1/auth/login
 * Authenticate with email + password.
 * Returns tokens directly, or a tempToken if 2FA is enabled.
 */
router.post(
  '/login',
  authLimiter,
  loginRules,
  validate,
  authController.login
);

/**
 * POST /api/v1/auth/2fa/verify
 * Complete login by submitting a TOTP code or backup code.
 * Requires the tempToken issued by /login.
 */
router.post(
  '/2fa/verify',
  authLimiter,
  twoFactorVerifyRules,
  validate,
  authController.verifyTwoFactor
);

/**
 * POST /api/v1/auth/refresh
 * Exchange a refresh token for a new access + refresh token pair.
 */
router.post(
  '/refresh',
  refreshTokenRules,
  validate,
  authController.refreshToken
);

// ── Protected routes (valid JWT required) ────────────────────────────────────

/**
 * GET /api/v1/auth/me
 * Return the currently authenticated user's profile.
 */
router.get('/me', protect, authController.getMe);

/**
 * POST /api/v1/auth/2fa/setup
 * Generate a new TOTP secret and QR code for 2FA enrollment.
 */
router.post('/2fa/setup', protect, authController.setup2FA);

/**
 * POST /api/v1/auth/2fa/enable
 * Confirm a TOTP code to activate 2FA on the account.
 */
router.post(
  '/2fa/enable',
  protect,
  twoFactorSetupVerifyRules,
  validate,
  authController.enable2FA
);

/**
 * DELETE /api/v1/auth/2fa/disable
 * Disable 2FA. Requires current password for confirmation.
 */
router.delete(
  '/2fa/disable',
  protect,
  [body('password').notEmpty().withMessage('Password is required')],
  validate,
  authController.disable2FA
);

/**
 * PATCH /api/v1/auth/password
 * Change the user's password (requires current password).
 */
router.patch(
  '/password',
  protect,
  changePasswordRules,
  validate,
  authController.changePassword
);

/**
 * POST /api/v1/auth/logout
 * Signal logout (client should discard tokens).
 */
router.post('/logout', protect, authController.logout);

module.exports = router;
