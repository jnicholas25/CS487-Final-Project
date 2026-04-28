const { body, query, param } = require('express-validator');
const mongoose = require('mongoose');

// ── Shared helpers ────────────────────────────────────────────────────────────

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);
const objectIdMsg = 'Must be a valid MongoDB ObjectId';

const FREQUENCIES = ['once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

// ── Rule sets ─────────────────────────────────────────────────────────────────

/**
 * Rules for POST /payments — create a new scheduled payment.
 */
const createPaymentRules = [
  body('accountId')
    .notEmpty().withMessage('accountId is required')
    .custom(isObjectId).withMessage(objectIdMsg),

  body('name')
    .notEmpty().withMessage('Payment name is required')
    .trim()
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),

  body('payeeName')
    .notEmpty().withMessage('Payee name is required')
    .trim()
    .isLength({ max: 100 }).withMessage('Payee name cannot exceed 100 characters'),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),

  body('frequency')
    .notEmpty().withMessage('Frequency is required')
    .isIn(FREQUENCIES)
    .withMessage(`Frequency must be one of: ${FREQUENCIES.join(', ')}`),

  body('startDate')
    .notEmpty().withMessage('Start date is required')
    .isISO8601().withMessage('startDate must be a valid ISO 8601 date'),

  body('nextDueDate')
    .notEmpty().withMessage('Next due date is required')
    .isISO8601().withMessage('nextDueDate must be a valid ISO 8601 date'),

  body('endDate')
    .optional()
    .isISO8601().withMessage('endDate must be a valid ISO 8601 date'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters'),

  body('payeeReference')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Payee reference cannot exceed 100 characters'),

  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-character ISO code')
    .isAlpha().withMessage('Currency must contain only letters'),

  body('isVariableAmount')
    .optional()
    .isBoolean().withMessage('isVariableAmount must be a boolean'),

  body('dayOfMonth')
    .optional()
    .isInt({ min: 1, max: 31 }).withMessage('dayOfMonth must be between 1 and 31'),

  body('dayOfWeek')
    .optional()
    .isInt({ min: 0, max: 6 }).withMessage('dayOfWeek must be between 0 (Sun) and 6 (Sat)'),

  body('requireBalanceCheck')
    .optional()
    .isBoolean(),

  body('minimumBalanceRequired')
    .optional()
    .isFloat({ min: 0 }),

  body('skipIfInsufficientFunds')
    .optional()
    .isBoolean(),

  body('notifyBeforeDays')
    .optional()
    .isInt({ min: 0, max: 30 }).withMessage('notifyBeforeDays must be between 0 and 30'),

  body('notifyOnExecution')
    .optional()
    .isBoolean(),

  body('notifyOnFailure')
    .optional()
    .isBoolean(),
];

/**
 * Rules for PATCH /payments/:id — partial update.
 */
const updatePaymentRules = [
  param('id')
    .custom(isObjectId).withMessage(objectIdMsg),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body('amount')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),

  body('frequency')
    .optional()
    .isIn(FREQUENCIES),

  body('startDate')
    .optional()
    .isISO8601(),

  body('endDate')
    .optional()
    .isISO8601(),

  body('nextDueDate')
    .optional()
    .isISO8601(),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }),

  body('dayOfMonth')
    .optional()
    .isInt({ min: 1, max: 31 }),

  body('dayOfWeek')
    .optional()
    .isInt({ min: 0, max: 6 }),

  body('notifyBeforeDays')
    .optional()
    .isInt({ min: 0, max: 30 }),

  body('isVariableAmount')
    .optional()
    .isBoolean(),
];

/**
 * Rules for GET /payments — list & filter.
 */
const listPaymentRules = [
  query('status')
    .optional()
    .isIn(['active', 'paused', 'cancelled', 'completed'])
    .withMessage('Invalid status'),

  query('frequency')
    .optional()
    .isIn(FREQUENCIES)
    .withMessage('Invalid frequency'),

  query('page')
    .optional()
    .isInt({ min: 1 }),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }),

  query('sortBy')
    .optional()
    .isIn(['nextDueDate', 'amount', 'name', 'createdAt']),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc']),
];

/**
 * Rules for PATCH /payments/:id/pause — optionally pause until a date.
 */
const pausePaymentRules = [
  param('id')
    .custom(isObjectId).withMessage(objectIdMsg),

  body('pausedUntil')
    .optional()
    .isISO8601().withMessage('pausedUntil must be a valid ISO 8601 date'),
];

/**
 * Rules for POST /payments/:id/execute — execute with optional override amount.
 */
const executePaymentRules = [
  param('id')
    .custom(isObjectId).withMessage(objectIdMsg),

  body('overrideAmount')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('overrideAmount must be a positive number'),
];

/**
 * Generic :id param rules.
 */
const idParamRules = [
  param('id')
    .custom(isObjectId).withMessage(objectIdMsg),
];

module.exports = {
  createPaymentRules,
  updatePaymentRules,
  listPaymentRules,
  pausePaymentRules,
  executePaymentRules,
  idParamRules,
};
