/**
 * Budget Monitor — Algorithm 5.5
 *
 * Handles two responsibilities:
 *   1. Spending sync — queries committed transactions in the budget period,
 *      aggregates totals per category, and writes them back to the Budget document.
 *   2. Alert checks — after every sync, evaluates each BudgetCategory against
 *      its alertThreshold and flags breaches at the 80 % warning and 100 % limit levels.
 *
 * Alert events are returned as structured objects rather than sent directly so
 * the calling layer (controller / scheduled job) can decide how to deliver them
 * (push notification, email, in-app alert, etc.).
 */

const Budget = require('../../models/Budget');
const Transaction = require('../../models/Transaction');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');

// ── Constants ─────────────────────────────────────────────────────────────────

const WARNING_LEVEL = 80;   // percent — "approaching limit" alert
const BREACH_LEVEL  = 100;  // percent — "over budget" alert

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Re-compute the spent amount for every category in a budget by aggregating
 * real transaction data, then persist the updated Budget document.
 *
 * Only debit and fee transactions that fall within the budget period and are
 * not duplicates or soft-deleted are included in the totals.
 *
 * @param {string} budgetId
 * @param {string} userId   Used to scope the transaction query (safety check).
 * @returns {Promise<{ budget: Budget, alerts: Alert[] }>}
 */
async function syncBudgetSpending(budgetId, userId) {
  const budget = await Budget.findOne({
    _id: budgetId,
    userId,
    deletedAt: null,
  });

  if (!budget) {
    const err = new Error('Budget not found');
    err.statusCode = 404;
    err.code = 'BUDGET_NOT_FOUND';
    throw err;
  }

  // Aggregate spending by category for the budget period
  const spendingMap = await _aggregateSpending(
    userId,
    budget.startDate,
    budget.endDate
  );

  // Update each category's spent amount
  let changed = false;
  for (const cat of budget.categories) {
    const newSpent = spendingMap.get(cat.category) || 0;
    if (cat.spent !== newSpent) {
      cat.spent = newSpent;
      changed = true;
    }
  }

  if (changed) {
    budget.markModified('categories');
    await budget.save(); // pre-save hook recomputes totalSpent / totalLimit
  }

  const alerts = checkAndTriggerAlerts(budget);

  logger.info(`[BudgetMonitor] Synced budget ${budgetId} — ${alerts.length} alert(s)`);
  return { budget, alerts };
}

/**
 * Sync all active, non-deleted budgets for a given user.
 * Returns a flat list of all alerts raised.
 *
 * @param {string} userId
 * @returns {Promise<Alert[]>}
 */
async function syncAllActiveBudgets(userId) {
  const budgets = await Budget.find({
    userId,
    isActive: true,
    deletedAt: null,
  });

  const allAlerts = [];

  for (const budget of budgets) {
    try {
      const { alerts } = await syncBudgetSpending(budget._id.toString(), userId);
      allAlerts.push(...alerts);
    } catch (err) {
      logger.error(`[BudgetMonitor] Failed to sync budget ${budget._id}: ${err.message}`);
    }
  }

  return allAlerts;
}

/**
 * Inspect every category in a budget and generate alert objects for any that
 * are at or beyond their alert threshold or have exceeded their limit.
 *
 * Does NOT mark alertSent — the caller is responsible for that once delivery
 * is confirmed.
 *
 * @param {Budget} budget  Mongoose document (or plain object with categories array).
 * @returns {Alert[]}
 */
function checkAndTriggerAlerts(budget) {
  const alerts = [];

  for (const cat of budget.categories) {
    if (cat.limit === 0) continue;

    const pct = Math.round((cat.spent / cat.limit) * 100);

    if (pct >= BREACH_LEVEL) {
      alerts.push(_buildAlert(budget, cat, 'breach', pct));
    } else if (pct >= (cat.alertThreshold || WARNING_LEVEL)) {
      alerts.push(_buildAlert(budget, cat, 'warning', pct));
    }
  }

  return alerts;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Run a MongoDB aggregation to get spending totals grouped by category.
 *
 * @param {string} userId
 * @param {Date}   startDate
 * @param {Date}   endDate
 * @returns {Promise<Map<string, number>>}  category → total amount
 */
async function _aggregateSpending(userId, startDate, endDate) {
  const rows = await Transaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
        type: { $in: ['debit', 'fee'] },
        isDuplicate: false,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
      },
    },
  ]);

  return new Map(rows.map((r) => [r._id, r.total]));
}

/**
 * Shape a single alert event.
 *
 * @param {Budget}          budget
 * @param {BudgetCategory}  cat
 * @param {'warning'|'breach'} level
 * @param {number}          percentUsed
 * @returns {Alert}
 */
function _buildAlert(budget, cat, level, percentUsed) {
  return {
    budgetId: budget._id.toString(),
    budgetName: budget.name || `Budget ${budget._id}`,
    category: cat.category,
    level,           // 'warning' | 'breach'
    percentUsed,
    spent: cat.spent,
    limit: cat.limit,
    overBy: Math.max(0, cat.spent - cat.limit),
    userId: budget.userId.toString(),
    triggeredAt: new Date(),
  };
}

module.exports = { syncBudgetSpending, syncAllActiveBudgets, checkAndTriggerAlerts };
