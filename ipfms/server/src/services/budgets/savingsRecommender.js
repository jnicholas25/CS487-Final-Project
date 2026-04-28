/**
 * Savings Recommender — Algorithm 5.5 (savings component)
 *
 * Analyses a user's budget performance and spending patterns to produce
 * actionable, prioritised savings recommendations.
 *
 * Recommendations are scored by potential impact (amount that could be saved)
 * and returned sorted highest-impact first.
 */

const Transaction = require('../../models/Transaction');
const mongoose = require('mongoose');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate savings recommendations based on a budget's category performance.
 *
 * Each recommendation contains:
 *   - category       : the spending category
 *   - type           : 'over_budget' | 'near_limit' | 'high_spend' | 'reduce_discretionary'
 *   - message        : human-readable suggestion
 *   - potentialSaving: estimated monthly saving if the advice is followed (USD)
 *   - priority       : 'high' | 'medium' | 'low'
 *
 * @param {string} userId
 * @param {Budget} budget   Mongoose Budget document (categories must be populated)
 * @returns {Promise<Recommendation[]>}
 */
async function generateRecommendations(userId, budget) {
  const recs = [];

  // ── 1. Per-category analysis ──────────────────────────────────────────────
  for (const cat of budget.categories) {
    if (cat.limit === 0) continue;

    const pct = cat.limit > 0 ? (cat.spent / cat.limit) * 100 : 0;

    if (cat.spent > cat.limit) {
      // Over budget
      const overBy = cat.spent - cat.limit;
      recs.push({
        category: cat.category,
        type: 'over_budget',
        message: `You've exceeded your ${cat.category} budget by $${overBy.toFixed(2)}. Consider cutting back or adjusting your limit.`,
        potentialSaving: overBy,
        priority: 'high',
      });
    } else if (pct >= 80) {
      // Near limit
      const remaining = cat.limit - cat.spent;
      recs.push({
        category: cat.category,
        type: 'near_limit',
        message: `You've used ${Math.round(pct)}% of your ${cat.category} budget with $${remaining.toFixed(2)} remaining. Slow down spending in this category.`,
        potentialSaving: cat.spent * 0.1, // 10 % reduction target
        priority: 'medium',
      });
    }
  }

  // ── 2. Discretionary category analysis ───────────────────────────────────
  const discretionary = ['Entertainment', 'Shopping', 'Food & Dining', 'Personal Care'];
  const history = await _getSpendingHistory(userId, budget.startDate, budget.endDate);

  for (const catName of discretionary) {
    const budgetCat = budget.categories.find((c) => c.category === catName);
    const historicalAvg = history.get(catName) || 0;

    // Only flag if the category has no budget and historical spend is significant
    if (!budgetCat && historicalAvg > 50) {
      recs.push({
        category: catName,
        type: 'high_spend',
        message: `You spent $${historicalAvg.toFixed(2)} on ${catName} last month but have no budget set for it. Adding a limit could help control spending.`,
        potentialSaving: historicalAvg * 0.15, // 15 % reduction target
        priority: 'low',
      });
    }
  }

  // ── 3. Savings goal gap ───────────────────────────────────────────────────
  if (budget.savingsGoal && budget.savingsGoal > 0) {
    const currentSurplus = Math.max(0, budget.totalLimit - budget.totalSpent);
    if (currentSurplus < budget.savingsGoal) {
      const gap = budget.savingsGoal - currentSurplus;
      recs.push({
        category: 'Overall',
        type: 'reduce_discretionary',
        message: `You're $${gap.toFixed(2)} short of your $${budget.savingsGoal.toFixed(2)} savings goal. Review discretionary categories to find areas to cut.`,
        potentialSaving: gap,
        priority: 'high',
      });
    }
  }

  // Sort by potential saving descending
  recs.sort((a, b) => b.potentialSaving - a.potentialSaving);

  return recs;
}

/**
 * Return a 0–100 savings health score for the given budget.
 *
 * Score interpretation:
 *   90-100  : Excellent — all categories under budget
 *   70-89   : Good — minor overages
 *   50-69   : Fair — several near-limit categories
 *   0-49    : Poor — significant budget breaches
 *
 * @param {Budget} budget
 * @returns {number}
 */
function getSavingsScore(budget) {
  if (!budget.categories || budget.categories.length === 0) return 100;

  let totalWeight = 0;
  let weightedScore = 0;

  for (const cat of budget.categories) {
    if (cat.limit === 0) continue;

    const weight = cat.limit; // larger budgets have more impact on score
    totalWeight += weight;

    const pct = (cat.spent / cat.limit) * 100;
    let catScore;

    if (pct <= 70)  catScore = 100;
    else if (pct <= 80)  catScore = 85;
    else if (pct <= 90)  catScore = 70;
    else if (pct <= 100) catScore = 50;
    else catScore = Math.max(0, 50 - (pct - 100)); // -1 per % over limit

    weightedScore += weight * catScore;
  }

  if (totalWeight === 0) return 100;
  return Math.round(weightedScore / totalWeight);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch last-period spending totals per category for historical comparison.
 * Uses the same period as the current budget, shifted back by one period length.
 *
 * @param {string} userId
 * @param {Date}   currentStart
 * @param {Date}   currentEnd
 * @returns {Promise<Map<string, number>>}
 */
async function _getSpendingHistory(userId, currentStart, currentEnd) {
  const periodMs = currentEnd.getTime() - currentStart.getTime();
  const prevEnd   = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);

  const rows = await Transaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: prevStart, $lte: prevEnd },
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

module.exports = { generateRecommendations, getSavingsScore };
