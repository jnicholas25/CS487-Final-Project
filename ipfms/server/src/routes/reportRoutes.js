'use strict';
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

router.get('/spending',      spendingReportRules,  validate, reportController.spendingReport);
router.get('/income',        incomeReportRules,    validate, reportController.incomeReport);
router.get('/net-worth',     reportController.netWorth);

// Chart data
router.get('/charts/spending-trend',    spendingTrendRules,     validate, reportController.spendingTrend);
// canonical + frontend alias
router.get('/charts/categories',         categoryBreakdownRules, validate, reportController.categoryBreakdown);
router.get('/charts/category-breakdown', categoryBreakdownRules, validate, reportController.categoryBreakdown);
router.get('/charts/income-vs-expense',  incomeVsExpenseRules,   validate, reportController.incomeVsExpense);

module.exports = router;
