/**
 * Report Generator — Step 7 (Financial Reports)
 *
 * generateSpendingReport(userId, opts)
 *   Aggregates debit/fee transactions by category within a date range.
 *   Returns category breakdown with totals, counts, and percentages.
 *
 * generateIncomeReport(userId, opts)
 *   Aggregates credit/refund transactions by category within a date range.
 *
 * generateNetWorthSnapshot(userId)
 *   Combines bank account balances + investment portfolio value to estimate
 *   total net worth at the current moment.
 */

const Transaction = require('../../models/Transaction');
const Account     = require('../../models/Account');
const Investment  = require('../../models/Investment');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Spending report — debits and fees grouped by category.
 *
 * @param {string|ObjectId} userId
 * @param {{
 *   startDate: string|Date,
 *   endDate: string|Date,
 *   accountId?: string,
 *   categories?: string[],
 * }} opts
 */
async function generateSpendingReport(userId, { startDate, endDate, accountId, categories }) {
  const match = {
    userId,
    type:        { $in: ['debit', 'fee'] },
    date:        { $gte: new Date(startDate), $lte: new Date(endDate) },
    deletedAt:   null,
    isDuplicate: false,
  };
  if (accountId)                        match.accountId = accountId;
  if (categories && categories.length)  match.category  = { $in: categories };

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id:   '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        // Keep the 10 largest transactions per category for context
        topTransactions: {
          $push: {
            _id:         '$_id',
            date:        '$date',
            description: '$description',
            amount:      '$amount',
          },
        },
      },
    },
    { $sort: { total: -1 } },
    {
      $project: {
        _id:      0,
        category: '$_id',
        total:    { $round: ['$total', 2] },
        count:    1,
        topTransactions: { $slice: ['$topTransactions', 10] },
      },
    },
  ];

  const rows       = await Transaction.aggregate(pipeline);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const txCount    = rows.reduce((s, r) => s + r.count, 0);

  return {
    period:           { startDate, endDate },
    grandTotal:       _round(grandTotal),
    transactionCount: txCount,
    categories:       rows.map((r) => ({
      ...r,
      percentage: grandTotal > 0 ? _round((r.total / grandTotal) * 100) : 0,
    })),
  };
}

/**
 * Income report — credits and refunds grouped by category.
 *
 * @param {string|ObjectId} userId
 * @param {{ startDate: string|Date, endDate: string|Date, accountId?: string }} opts
 */
async function generateIncomeReport(userId, { startDate, endDate, accountId }) {
  const match = {
    userId,
    // Credits in this system are stored as negative amounts
    type:        { $in: ['credit', 'refund'] },
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
        // abs() because credits are stored as negative
        total: { $sum: { $abs: '$amount' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
    {
      $project: {
        _id:      0,
        category: '$_id',
        total:    { $round: ['$total', 2] },
        count:    1,
      },
    },
  ];

  const rows       = await Transaction.aggregate(pipeline);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return {
    period:           { startDate, endDate },
    grandTotal:       _round(grandTotal),
    transactionCount: rows.reduce((s, r) => s + r.count, 0),
    categories:       rows.map((r) => ({
      ...r,
      percentage: grandTotal > 0 ? _round((r.total / grandTotal) * 100) : 0,
    })),
  };
}

/**
 * Net-worth snapshot — bank balances + investment portfolio value.
 *
 * @param {string|ObjectId} userId
 * @returns {Promise<{
 *   snapshotAt: Date,
 *   bankAccounts: object[],
 *   totalBankBalance: number,
 *   totalInvestmentValue: number,
 *   estimatedNetWorth: number,
 * }>}
 */
async function generateNetWorthSnapshot(userId) {
  const [accounts, investments] = await Promise.all([
    Account.find({ userId, isActive: true, deletedAt: null })
      .select('name accountType currentBalance currency'),
    Investment.find({ userId, isActive: true, deletedAt: null })
      .select('symbol name quantity currentPrice averageCostBasis assetType currency'),
  ]);

  const totalBankBalance = accounts.reduce(
    (s, a) => s + (a.currentBalance || 0), 0
  );

  // Use currentPrice if available; fall back to cost basis
  const totalInvestmentValue = investments.reduce((s, inv) => {
    const pricePerUnit = inv.currentPrice != null ? inv.currentPrice : inv.averageCostBasis;
    return s + inv.quantity * pricePerUnit;
  }, 0);

  return {
    snapshotAt: new Date(),
    bankAccounts: accounts.map((a) => ({
      name:     a.name,
      type:     a.accountType,
      balance:  a.currentBalance,
      currency: a.currency,
    })),
    investments: investments.map((inv) => ({
      symbol:     inv.symbol,
      name:       inv.name,
      assetType:  inv.assetType,
      quantity:   inv.quantity,
      priceUsed:  inv.currentPrice != null ? inv.currentPrice : inv.averageCostBasis,
      value:      _round(inv.quantity * (inv.currentPrice != null ? inv.currentPrice : inv.averageCostBasis)),
      hasCurrent: inv.currentPrice != null,
    })),
    totalBankBalance:      _round(totalBankBalance),
    totalInvestmentValue:  _round(totalInvestmentValue),
    estimatedNetWorth:     _round(totalBankBalance + totalInvestmentValue),
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { generateSpendingReport, generateIncomeReport, generateNetWorthSnapshot };
