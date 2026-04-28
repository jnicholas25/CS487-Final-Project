/**
 * Report Validator — Step 7 (Financial Reports)
 */

const { query } = require('express-validator');

// ── Shared ────────────────────────────────────────────────────────────────────

/** Reusable start/end date pair with cross-field validation. */
const dateRangeRules = [
  query('startDate')
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),

  query('endDate')
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date')
    .custom((endDate, { req }) => {
      if (req.query.startDate && new Date(endDate) < new Date(req.query.startDate)) {
        throw new Error('endDate must be on or after startDate');
      }
      return true;
    }),
];

// ── Rule sets ─────────────────────────────────────────────────────────────────

const spendingReportRules = [
  ...dateRangeRules,

  query('accountId')
    .optional()
    .isMongoId()
    .withMessage('Invalid accountId'),

  query('categories')
    .optional()
    .customSanitizer((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()) : v))
    .isArray()
    .withMessage('categories must be a comma-separated list or array'),
];

const incomeReportRules = [
  ...dateRangeRules,

  query('accountId')
    .optional()
    .isMongoId()
    .withMessage('Invalid accountId'),
];

const spendingTrendRules = [
  query('months')
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage('months must be between 1 and 24'),

  query('accountId')
    .optional()
    .isMongoId()
    .withMessage('Invalid accountId'),
];

const categoryBreakdownRules = [
  ...dateRangeRules,

  query('accountId')
    .optional()
    .isMongoId()
    .withMessage('Invalid accountId'),
];

const incomeVsExpenseRules = [
  query('months')
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage('months must be between 1 and 24'),
];

module.exports = {
  spendingReportRules,
  incomeReportRules,
  spendingTrendRules,
  categoryBreakdownRules,
  incomeVsExpenseRules,
};
