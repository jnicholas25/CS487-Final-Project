/**
 * Report Controller — Step 7 (Financial Reports)
 *
 * Routes:
 *   GET /api/v1/reports/spending              spending report (date range + filters)
 *   GET /api/v1/reports/income                income report
 *   GET /api/v1/reports/net-worth             net-worth snapshot
 *   GET /api/v1/reports/charts/spending-trend monthly spending trend
 *   GET /api/v1/reports/charts/categories     category breakdown (pie data)
 *   GET /api/v1/reports/charts/income-vs-expense  income vs expenses
 */

const { generateSpendingReport, generateIncomeReport, generateNetWorthSnapshot }
  = require('../services/reports/reportGenerator');
const { buildSpendingTrend, buildCategoryBreakdown, buildIncomeVsExpense }
  = require('../services/reports/chartDataBuilder');

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/spending
 * Query params: startDate, endDate, accountId?, categories? (comma-separated)
 */
async function spendingReport(req, res, next) {
  try {
    const userId = req.user._id;
    const { startDate, endDate, accountId, categories } = req.query;

    const result = await generateSpendingReport(userId, {
      startDate,
      endDate,
      accountId:  accountId  || null,
      categories: categories || null,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/reports/income
 * Query params: startDate, endDate, accountId?
 */
async function incomeReport(req, res, next) {
  try {
    const { startDate, endDate, accountId } = req.query;

    const result = await generateIncomeReport(req.user._id, {
      startDate,
      endDate,
      accountId: accountId || null,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/reports/net-worth
 */
async function netWorth(req, res, next) {
  try {
    const result = await generateNetWorthSnapshot(req.user._id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/reports/charts/spending-trend
 * Query params: months? (1–24, default 6), accountId?
 */
async function spendingTrend(req, res, next) {
  try {
    const months    = parseInt(req.query.months, 10) || 6;
    const accountId = req.query.accountId || null;

    const data = await buildSpendingTrend(req.user._id, { months, accountId });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/reports/charts/categories
 * Query params: startDate, endDate, accountId?
 */
async function categoryBreakdown(req, res, next) {
  try {
    const { startDate, endDate, accountId } = req.query;

    const data = await buildCategoryBreakdown(req.user._id, {
      startDate,
      endDate,
      accountId: accountId || null,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/reports/charts/income-vs-expense
 * Query params: months? (1–24, default 6)
 */
async function incomeVsExpense(req, res, next) {
  try {
    const months = parseInt(req.query.months, 10) || 6;
    const data   = await buildIncomeVsExpense(req.user._id, { months });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  spendingReport,
  incomeReport,
  netWorth,
  spendingTrend,
  categoryBreakdown,
  incomeVsExpense,
};
