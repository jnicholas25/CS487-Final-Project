/**
 * Report Routes — Step 7 (Financial Reports)
 *
 * All routes require authentication.
 * Chart endpoints live under /charts/* to keep them clearly grouped.
 */

const express = require('express');
const router  = express.Router();

const reportController = require('../controllers/reportController');
const { protect }      = require('../middleware/authMiddleware');
const { validate }     = require('../validators/authValidator');
const {
  spendingReportRules,
  incomeReportRules,
  spendingTrendRules,
  categoryBreakdownRules,
  incomeVsExpenseRules,
} = require('../validators/reportValidator');

router.use(protect);

// ── Report endpoints ──────────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/spending
 * Spending report with category breakdown for a date range.
 * Query params: startDate, endDate, accountId?, categories? (comma-separated)
 */
router.get('/spending', spendingReportRules, validate, reportController.spendingReport);

/**
 * GET /api/v1/reports/income
 * Income report with category breakdown for a date range.
 * Query params: startDate, endDate, accountId?
 */
router.get('/income', incomeReportRules, validate, reportController.incomeReport);

/**
 * GET /api/v1/reports/net-worth
 * Snapshot of total bank balances + investment portfolio value.
 */
router.get('/net-worth', reportController.netWorth);

// ── Chart data endpoints ──────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/charts/spending-trend
 * Monthly spending totals (line/bar chart).
 * Query params: months? (1–24), accountId?
 */
router.get('/charts/spending-trend', spendingTrendRules, validate, reportController.spendingTrend);

/**
 * GET /api/v1/reports/charts/categories
 * Spending by category (pie/donut chart).
 * Query params: startDate, endDate, accountId?
 */
router.get('/charts/categories', categoryBreakdownRules, validate, reportController.categoryBreakdown);

/**
 * GET /api/v1/reports/charts/income-vs-expense
 * Monthly income vs. expenses with net (grouped bar chart).
 * Query params: months? (1–24)
 */
router.get('/charts/income-vs-expense', incomeVsExpenseRules, validate, reportController.incomeVsExpense);

module.exports = router;
