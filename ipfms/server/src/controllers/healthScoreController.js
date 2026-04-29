'use strict';
/**
 * Health Score Controller — Step 8
 * Endpoints: GET /api/health-score, GET /api/health-score/history
 */

const { calculateHealthScore } = require('../services/health-score/healthScoreCalculator');

// Simple in-process cache (TTL 15 minutes per user)
// In production you would store these in Redis.
const _cache  = new Map(); // userId → { data, expiresAt }
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCached(userId) {
  const entry = _cache.get(String(userId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(String(userId)); return null; }
  return entry.data;
}
function setCache(userId, data) {
  _cache.set(String(userId), { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── GET /api/health-score ─────────────────────────────────────────────────────
exports.getScore = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Bust cache if ?refresh=1
    if (req.query.refresh === '1') _cache.delete(String(userId));

    let result = getCached(userId);
    if (!result) {
      result = await calculateHealthScore(userId);
      setCache(userId, result);
    }

    return res.json({
      score:         result.score,
      label:         result.label,
      components:    result.components,
      advice:        result.advice,
      computedAt:    result.computedAt,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/health-score/history ─────────────────────────────────────────────
// Returns the health score for each of the past N months.
// We compute each month independently by temporarily shifting "now" to the
// last day of that month. This is a best-effort retrospective estimate based
// on current account balances and historical transactions.
exports.getHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const months = Math.min(12, Math.max(1, parseInt(req.query.months, 10) || 6));

    const history = [];
    const now     = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      // Current month → compute fresh; past months → simplified (savings + budget)
      if (i === 0) {
        let current = getCached(userId);
        if (!current) {
          current = await calculateHealthScore(userId);
          setCache(userId, current);
        }
        history.push({ month: label, score: current.score, label: current.label });
      } else {
        // Simplified past-month score: only compute savingsRate for that month
        // (full retrospective would be expensive — use a lighter estimate)
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

        const Transaction = require('../models/Transaction');
        const [row] = await Transaction.aggregate([
          { $match: { userId, date: { $gte: startOfMonth, $lte: endOfMonth }, deletedAt: null } },
          { $group: {
            _id: null,
            income:   { $sum: { $cond: [{ $in: ['$type', ['credit', 'refund']] }, { $abs: '$amount' }, 0] } },
            expenses: { $sum: { $cond: [{ $in: ['$type', ['debit', 'fee']] },     { $abs: '$amount' }, 0] } },
          }},
        ]);

        let estScore = 55; // neutral baseline for past months with no data
        if (row && row.income > 0) {
          const savingsRate = Math.max(0, (row.income - row.expenses) / row.income);
          estScore = Math.round(Math.min(100, 40 + savingsRate * 200)); // rough estimate
        }

        const { scoreBand } = require('../services/health-score/healthScoreCalculator');
        history.push({ month: label, score: estScore, label: scoreBand(estScore), estimated: i > 0 });
      }
    }

    return res.json({ history, months });
  } catch (err) {
    next(err);
  }
};
