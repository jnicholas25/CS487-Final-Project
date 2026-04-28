/**
 * Investment Validator — Step 7 (Investment Tracker & Financial Reports)
 */

const { body, param, query } = require('express-validator');

const ASSET_TYPES = ['stock', 'etf', 'mutual_fund', 'crypto', 'bond', 'other'];
const DIVIDEND_TYPES = ['cash', 'stock', 'drip'];

// ── Rule sets ─────────────────────────────────────────────────────────────────

const idParamRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid investment ID'),
];

const createInvestmentRules = [
  body('symbol')
    .trim()
    .notEmpty().withMessage('Symbol is required')
    .isLength({ max: 20 }).withMessage('Symbol cannot exceed 20 characters'),

  body('name')
    .trim()
    .notEmpty().withMessage('Investment name is required')
    .isLength({ max: 200 }).withMessage('Name cannot exceed 200 characters'),

  body('assetType')
    .optional()
    .isIn(ASSET_TYPES)
    .withMessage(`assetType must be one of: ${ASSET_TYPES.join(', ')}`),

  body('quantity')
    .isFloat({ min: 0 }).withMessage('Quantity must be a non-negative number'),

  body('averageCostBasis')
    .isFloat({ min: 0 }).withMessage('Average cost basis must be a non-negative number'),

  body('currentPrice')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Current price must be a non-negative number'),

  body('accountId')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid accountId'),

  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code')
    .isAlpha().withMessage('Currency must contain only letters'),

  body('exchange')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 50 }).withMessage('Exchange cannot exceed 50 characters'),

  body('purchaseDate')
    .optional({ nullable: true })
    .isISO8601().withMessage('purchaseDate must be a valid ISO 8601 date'),

  body('notes')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters'),

  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),
];

const updateInvestmentRules = [
  param('id')
    .isMongoId().withMessage('Invalid investment ID'),

  body('quantity')
    .optional()
    .isFloat({ min: 0 }).withMessage('Quantity must be a non-negative number'),

  body('averageCostBasis')
    .optional()
    .isFloat({ min: 0 }).withMessage('Average cost basis must be a non-negative number'),

  body('currentPrice')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Current price must be a non-negative number'),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Name cannot exceed 200 characters'),

  body('exchange')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 50 }).withMessage('Exchange cannot exceed 50 characters'),

  body('purchaseDate')
    .optional({ nullable: true })
    .isISO8601().withMessage('purchaseDate must be a valid ISO 8601 date'),

  body('notes')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters'),
];

const addDividendRules = [
  param('id')
    .isMongoId().withMessage('Invalid investment ID'),

  body('amount')
    .isFloat({ min: 0 }).withMessage('Dividend amount must be a non-negative number'),

  body('date')
    .isISO8601().withMessage('Dividend date must be a valid ISO 8601 date'),

  body('type')
    .optional()
    .isIn(DIVIDEND_TYPES)
    .withMessage(`Dividend type must be one of: ${DIVIDEND_TYPES.join(', ')}`),

  body('notes')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
];

const listInvestmentRules = [
  query('assetType')
    .optional()
    .isIn(ASSET_TYPES)
    .withMessage(`assetType must be one of: ${ASSET_TYPES.join(', ')}`),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

module.exports = {
  idParamRules,
  createInvestmentRules,
  updateInvestmentRules,
  addDividendRules,
  listInvestmentRules,
};
