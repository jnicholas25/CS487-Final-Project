const { body, validationResult } = require('express-validator');

/**
 * Reusable middleware that reads express-validator results and returns
 * a 422 response if any validation errors are present.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// ── Rule sets ─────────────────────────────────────────────────────────────────

const registerRules = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters'),

  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character'),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\+?[1-9]\d{6,14}$/).withMessage('Please provide a valid phone number'),
];

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

const twoFactorVerifyRules = [
  body('tempToken')
    .notEmpty().withMessage('Temp token is required'),

  body('totpCode')
    .optional()
    .isLength({ min: 6, max: 6 }).withMessage('TOTP code must be 6 digits')
    .isNumeric().withMessage('TOTP code must be numeric'),

  body('backupCode')
    .optional()
    .isLength({ min: 8, max: 12 }).withMessage('Invalid backup code format'),
];

const twoFactorSetupVerifyRules = [
  body('secret')
    .notEmpty().withMessage('Secret is required'),

  body('token')
    .notEmpty().withMessage('Verification token is required')
    .isLength({ min: 6, max: 6 }).withMessage('Token must be 6 digits')
    .isNumeric().withMessage('Token must be numeric'),
];

const refreshTokenRules = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token is required'),
];

const changePasswordRules = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character'),

  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your new password')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  twoFactorVerifyRules,
  twoFactorSetupVerifyRules,
  refreshTokenRules,
  changePasswordRules,
};
