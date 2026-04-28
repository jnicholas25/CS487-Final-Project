const { body, param } = require('express-validator');
const mongoose = require('mongoose');

// ── Shared helpers ────────────────────────────────────────────────────────────

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);
const objectIdMsg = 'Must be a valid MongoDB ObjectId';

// ── Rule sets ─────────────────────────────────────────────────────────────────

/**
 * Rules for POST /budgets — create a new budget.
 */
const createBudgetRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),

  body('period')
    .optional()
    .isIn(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'])
    .withMessage('Period must be one of: weekly, biweekly, monthly, quarterly, yearly, custom'),

  body('startDate')
    .notEmpty().withMessage('startDate is required')
    .isISO8601().withMessage('startDate must be a valid ISO 8601 date'),

  body('endDate')
    .notEmpty().withMessage('endDate is required')
    .isISO8601().withMessage('endDate must be a valid ISO 8601 date')
    .custom((val, { req }) => {
      if (new Date(val) <= new Date(req.body.startDate)) {
        throw new Error('endDate must be after startDate');
      }
      return true;
    }),

  body('categories')
    .optional()
    .isArray().withMessage('categories must be an array'),

  body('categories.*.category')
    .if(body('categories').exists())
    .notEmpty().withMessage('Each category must have a name')
    .trim()
    .isLength({ max: 100 }).withMessage('Category name cannot exceed 100 characters'),

  body('categories.*.limit')
    .if(body('categories').exists())
    .notEmpty().withMessage('Each category must have a limit')
    .isFloat({ min: 0 }).withMessage('Category limit must be a non-negative number'),

  body('categories.*.alertThreshold')
    .optional()
    .isFloat({ min: 1, max: 100 }).withMessage('alertThreshold must be between 1 and 100'),

  body('categories.*.color')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('Color cannot exceed 20 characters'),

  body('categories.*.notes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Category notes cannot exceed 500 characters'),

  body('rolloverEnabled')
    .optional()
    .isBoolean().withMessage('rolloverEnabled must be a boolean'),

  body('savingsGoal')
    .optional()
    .isFloat({ min: 0 }).withMessage('savingsGoal must be a non-negative number'),

  body('isTemplate')
    .optional()
    .isBoolean().withMessage('isTemplate must be a boolean'),
];

/**
 * Rules for PATCH /budgets/:id — partial update.
 * Same fields as create, all optional.
 */
const updateBudgetRules = [
  param('id')
    .custom(isObjectId).withMessage(objectIdMsg),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),

  body('period')
    .optional()
    .isIn(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'])
    .withMessage('Invalid period value'),

  body('startDate')
    .optional()
    .isISO8601().withMessage('startDate must be a valid date'),

  body('endDate')
    .optional()
    .isISO8601().withMessage('endDate must be a valid date'),

  body('categories')
    .optional()
    .isArray().withMessage('categories must be an array'),

  body('categories.*.category')
    .if(body('categories').exists())
    .notEmpty().withMessage('Each category must have a name')
    .trim()
    .isLength({ max: 100 }),

  body('categories.*.limit')
    .if(body('categories').exists())
    .notEmpty().withMessage('Each category must have a limit')
    .isFloat({ min: 0 }),

  body('categories.*.alertThreshold')
    .optional()
    .isFloat({ min: 1, max: 100 }),

  body('rolloverEnabled')
    .optional()
    .isBoolean(),

  body('savingsGoal')
    .optional()
    .isFloat({ min: 0 }),

  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean'),
];

/**
 * Rules for routes with an :id parameter.
 */
const idParamRules = [
  param('id')
    .custom(isObjectId).withMessage(objectIdMsg),
];

module.exports = {
  createBudgetRules,
  updateBudgetRules,
  idParamRules,
};
