const express = require('express');
const router = express.Router();

const budgetController = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../validators/authValidator');
const {
  createBudgetRules,
  updateBudgetRules,
  idParamRules,
} = require('../validators/budgetValidator');

// All budget routes require authentication
router.use(protect);

/**
 * GET /api/v1/budgets
 * List the user's budgets.
 * Query params: isActive, isTemplate, page, limit
 */
router.get('/', budgetController.list);

/**
 * POST /api/v1/budgets
 * Create a new budget.
 */
router.post('/', createBudgetRules, validate, budgetController.create);

/**
 * GET /api/v1/budgets/:id
 * Retrieve a single budget by ID.
 */
router.get('/:id', idParamRules, validate, budgetController.getOne);

/**
 * PATCH /api/v1/budgets/:id
 * Update user-editable fields on an existing budget.
 */
router.patch('/:id', updateBudgetRules, validate, budgetController.update);

/**
 * DELETE /api/v1/budgets/:id
 * Soft-delete a budget.
 */
router.delete('/:id', idParamRules, validate, budgetController.remove);

/**
 * POST /api/v1/budgets/:id/sync
 * Pull the latest transaction spending into the budget's category totals
 * and return any triggered alerts.
 */
router.post('/:id/sync', idParamRules, validate, budgetController.sync);

/**
 * GET /api/v1/budgets/:id/recommendations
 * Return AI-generated savings recommendations for the budget.
 */
router.get('/:id/recommendations', idParamRules, validate, budgetController.recommendations);

module.exports = router;
