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

// Public routes (no token required)

router.post('/register', authLimiter, registerRules, validate, authController.register);
router.post('/login', authLimiter, loginRules, validate, authController.login);
router.post('/2fa/verify', authLimiter, twoFactorVerifyRules, validate, authController.verifyTwoFactor);
router.post('/refresh', refreshTokenRules, validate, authController.refreshToken);

// Protected routes (valid JWT required)

router.get('/me', protect, authController.getMe);
router.put('/me', protect, authController.updateMe);

router.post('/2fa/setup', protect, authController.setup2FA);

// POST /2fa/enable  (canonical) + POST /2fa/confirm (frontend alias)
router.post('/2fa/enable',  protect, twoFactorSetupVerifyRules, validate, authController.enable2FA);
router.post('/2fa/confirm', protect, twoFactorSetupVerifyRules, validate, authController.enable2FA);

// DELETE /2fa/disable (REST) + POST /2fa/disable (frontend alias)
router.delete('/2fa/disable', protect,
  [body('password').notEmpty().withMessage('Password is required')],
  validate, authController.disable2FA);
router.post('/2fa/disable', protect,
  [body('password').notEmpty().withMessage('Password is required')],
  validate, authController.disable2FA);

// PATCH /password (canonical) + POST /change-password (frontend alias)
router.patch('/password',         protect, changePasswordRules, validate, authController.changePassword);
router.post('/change-password',   protect, changePasswordRules, validate, authController.changePassword);

router.post('/logout', protect, authController.logout);

module.exports = router;
