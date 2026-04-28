const express = require('express');
const router = express.Router();

const transactionController = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../validators/authValidator');
const {
  createTransactionRules,
  updateTransactionRules,
  listTransactionRules,
  summaryRules,
  idParamRules,
} = require('../validators/transactionValidator');

// All transaction routes require authentication
router.use(protect);

/**
 * GET /api/v1/transactions
 * List and filter the user's transactions.
 * Query params: accountId, category, type, startDate, endDate,
 *               isFlagged, isRecurring, search, page, limit, sortBy, sortOrder
 */
router.get('/', listTransactionRules, validate, transactionController.list);

/**
 * GET /api/v1/transactions/summary
 * Spending totals grouped by category for a date range.
 * Query params: startDate (required), endDate (required), accountId (optional)
 */
router.get('/summary', summaryRules, validate, transactionController.summary);

/**
 * POST /api/v1/transactions
 * Manually create a new transaction.
 */
router.post('/', createTransactionRules, validate, transactionController.create);

/**
 * GET /api/v1/transactions/:id
 * Retrieve a single transaction by ID.
 */
router.get('/:id', idParamRules, validate, transactionController.getOne);

/**
 * PATCH /api/v1/transactions/:id
 * Update user-editable fields (description, notes, category, tags, isRecurring).
 */
router.patch('/:id', updateTransactionRules, validate, transactionController.update);

/**
 * DELETE /api/v1/transactions/:id
 * Soft-delete a transaction.
 */
router.delete('/:id', idParamRules, validate, transactionController.remove);

/**
 * PATCH /api/v1/transactions/:id/flag
 * Toggle the fraud-flag on a transaction (user feedback loop).
 */
router.patch('/:id/flag', idParamRules, validate, transactionController.toggleFlag);

module.exports = router;
