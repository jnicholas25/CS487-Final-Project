const { body, query, param } = require('express-validator');
const mongoose = require('mongoose');

// ── Shared helpers ────────────────────────────────────────────────────────────

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const objectIdMsg = 'Must be a valid MongoDB ObjectId';

// ── Rule sets ─────────────────────────────────────────────────────────────────

/**
 * Rules for POST /transactions — manual transaction entry.
 */
const createTransactionRules = [
  body('accountId')
    .notEmpty().withMessage('accountId is required')
    .custom(isObjectId).withMessage(objectIdMsg),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat().withMessage('Amount must be a number')
    .custom((v) => v !== 0).withMessage('Amount cannot be zero'),

  body('type')
    .notEmpty().withMessage('Transaction type is required')
    .isIn(['debit', 'credit', 'transfer', 'refund', 'fee'])
    .withMessage('Type must be one of: debit, credit, transfer, refund, fee'),

  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Date must be a valid ISO 8601 date'),

  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),

  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-character ISO code')
    .isAlpha().withMessage('Currency must contain only letters'),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters'),

  body('subcategory')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Subcategory cannot exceed 100 characters'),

  body('categorySource')
    .optional()
    .isIn(['auto', 'user', 'rule']).withMessage('categorySource must be auto, user, or rule'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters'),

  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .isString().withMessage('Each tag must be a string')
    .isLength({ max: 50 }).withMessage('Each tag cannot exceed 50 characters'),

  body('isPending')
    .optional()
    .isBoolean().withMessage('isPending must be a boolean'),

  body('isRecurring')
    .optional()
    .isBoolean().withMessage('isRecurring must be a boolean'),

  body('externalId')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('externalId cannot exceed 200 characters'),

  body('postedAt')
    .optional()
    .isISO8601().withMessage('postedAt must be a valid ISO 8601 date'),

  body('merchant')
    .optional()
    .isObject().withMessage('merchant must be an object'),

  body('merchant.name')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Merchant name cannot exceed 200 characters'),

  body('location')
    .optional()
    .isObject().withMessage('location must be an object'),
];

/**
 * Rules for PATCH /transactions/:id — partial update (user-editable fields only).
 */
const updateTransactionRules = [
  param('id')
    .custom(isObjectId).withMessage(objectIdMsg),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 }).withMessage('Description must be 1–500 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters'),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters'),

  body('subcategory')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Subcategory cannot exceed 100 characters'),

  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),

  body('isRecurring')
    .optional()
    .isBoolean().withMessage('isRecurring must be a boolean'),
];

/**
 * Rules for GET /transactions — list & filter.
 */
const listTransactionRules = [
  query('accountId')
    .optional({ checkFalsy: true })
    .custom(isObjectId).withMessage(objectIdMsg),

  query('startDate')
    .optional()
    .isISO8601().withMessage('startDate must be a valid date'),

  query('endDate')
    .optional()
    .isISO8601().withMessage('endDate must be a valid date'),

  query('category')
    .optional()
    .isString(),

  query('type')
    .optional({ checkFalsy: true })
    .isIn(['debit', 'credit', 'transfer', 'refund', 'fee'])
    .withMessage('Invalid transaction type'),

  query('isFlagged')
    .optional()
    .isBoolean().withMessage('isFlagged must be true or false'),

  query('isRecurring')
    .optional()
    .isBoolean().withMessage('isRecurring must be true or false'),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),

  query('sortBy')
    .optional()
    .isIn(['date', 'amount', 'category', 'createdAt'])
    .withMessage('Invalid sortBy field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc'),

  query('search')
    .optional()
    .isString()
    .isLength({ max: 100 }).withMessage('Search term cannot exceed 100 characters'),
];

/**
 * Rules for GET /transactions/summary — spending by category.
 */
const summaryRules = [
  query('startDate')
    .notEmpty().withMessage('startDate is required')
    .isISO8601().withMessage('startDate must be a valid date'),

  query('endDate')
    .notEmpty().withMessage('endDate is required')
    .isISO8601().withMessage('endDate must be a valid date'),

  query('accountId')
    .optional()
    .custom(isObjectId).withMessage(objectIdMsg),
];

/**
 * Rules for param :id validation used on single-resource routes.
 */
const idParamRules = [
  param('id')
    .custom(isObjectId).withMessage(objectIdMsg),
];

module.exports = {
  createTransactionRules,
  updateTransactionRules,
  listTransactionRules,
  summaryRules,
  idParamRules,
};
