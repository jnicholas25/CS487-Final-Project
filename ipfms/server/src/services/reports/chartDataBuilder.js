/**
 * Chart Data Builder — Step 7 (Financial Reports)
 *
 * Provides aggregation pipelines that produce ready-to-render chart datasets.
 *
 * buildSpendingTrend(userId, opts)
 *   Monthly spending totals over the last N months (line / bar chart).
 *
 * buildCategoryBreakdown(userId, opts)
 *   Spending by category for a date range (pie / donut chart).
 *
 * buildIncomeVsExpense(userId, opts)
 *   Monthly income vs. expenses with net value (grouped bar chart).
 */

const Transaction = require('../../models/Transaction');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Monthly spending trend.
 *
 * @param {string|ObjectId} userId
 * @param {{ months?: number, accountId?: string }} opts
 * @returns {Promise<{ month: string, total: number, count: number }[]>}
 *   Sorted oldest → newest.  month format: 'YYYY-MM'.
 */
async function buildSpendingTrend(userId, { months = 6, accountId } = {}) {
  const startDate = _monthsAgo(months);

  const match = {
    userId,
    type:        { $in: ['debit', 'fee'] },
    date:        { $gte: startDate },
    deletedAt:   null,
    isDuplicate: false,
  };
  if (accountId) match.accountId = accountId;

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          year:  { $year: '$date' },
          month: { $month: '$date' },
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    {
      $project: {
        _id:   0,
        month: _monthLabel(),
        total: { $round: ['$total', 2] },
        count: 1,
      },
    },
  ];

  return Transaction.aggregate(pipeline);
}

/**
 * Category breakdown for a date range (pie/donut chart data).
 *
 * @param {string|ObjectId} userId
 * @param {{ startDate: string|Date, endDate: string|Date, accountId?: string }} opts
 * @returns {Promise<{ category: string, total: number, count: number, percentage: number }[]>}
 */
async function buildCategoryBreakdown(userId, { startDate, endDate, accountId } = {}) {
  const match = {
    userId,
    type:        { $in: ['debit', 'fee'] },
    date:        { $gte: new Date(startDate), $lte: new Date(endDate) },
    deletedAt:   null,
    isDuplicate: false,
  };
  if (accountId) match.accountId = accountId;

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id:   '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ];

  const raw        = await Transaction.aggregate(pipeline);
  const grandTotal = raw.reduce((s, r) => s + r.total, 0);

  return raw.map((r) => ({
    category:   r._id,
    total:      Math.round(r.total * 100) / 100,
    count:      r.count,
    percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 10000) / 100 : 0,
  }));
}

/**
 * Income vs. expenses by month (grouped bar chart data).
 *
 * @param {string|ObjectId} userId
 * @param {{ months?: number }} opts
 * @returns {Promise<{ month: string, income: number, expenses: number, net: number }[]>}
 *   Sorted oldest → newest.
 */
async function buildIncomeVsExpense(userId, { months = 6 } = {}) {
  const startDate = _monthsAgo(months);

  const pipeline = [
    {
      $match: {
        userId,
        type:        { $in: ['debit', 'credit', 'fee', 'refund'] },
        date:        { $gte: startDate },
        deletedAt:   null,
        isDuplicate: false,
      },
    },
    {
      $group: {
        _id: {
          year:  { $year: '$date' },
          month: { $month: '$date' },
        },
        // Expenses: sum of debit + fee amounts (positive numbers)
        expenses: {
          $sum: {
            $cond: [{ $in: ['$type', ['debit', 'fee']] }, '$amount', 0],
          },
        },
        // Income: abs of credit + refund amounts (stored as negatives)
        income: {
          $sum: {
            $cond: [{ $in: ['$type', ['credit', 'refund']] }, { $abs: '$amount' }, 0],
          },
        },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    {
      $project: {
        _id:      0,
        month:    _monthLabel(),
        expenses: { $round: ['$expenses', 2] },
        income:   { $round: ['$income', 2] },
        net: {
          $round: [{ $subtract: ['$income', '$expenses'] }, 2],
        },
      },
    },
  ];

  return Transaction.aggregate(pipeline);
}

// ── Private helpers ───────────────────────────────────────────────────────────

/** Returns a Date set to the 1st of the month N months ago, at midnight UTC. */
function _monthsAgo(n) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n + 1);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Aggregation $project expression that converts { year, month } _id to 'YYYY-MM'.
 * Must be used inside a $project stage after grouping with _id.year / _id.month.
 */
function _monthLabel() {
  return {
    $dateToString: {
      format: '%Y-%m',
      date: {
        $dateFromParts: {
          year:  '$_id.year',
          month: '$_id.month',
          day:   { $literal: 1 },
        },
      },
    },
  };
}

module.exports = { buildSpendingTrend, buildCategoryBreakdown, buildIncomeVsExpense };
