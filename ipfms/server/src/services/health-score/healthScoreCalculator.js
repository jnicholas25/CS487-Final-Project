'use strict';
/**
 * Algorithm 5.6 — Financial Health Score
 *
 * Composite weighted score (0-100) derived from five sub-metrics:
 *
 *  Component              Weight  Description
 *  ─────────────────────  ──────  ────────────────────────────────────────────
 *  Savings Rate             25%   (income - expenses) / income for past 30 days
 *  Budget Adherence         25%   fraction of budget categories NOT exceeded
 *  Payment History          20%   successful scheduled payments / total processed
 *  Debt-to-Income           15%   1 - min(1, totalDebt / monthlyIncome)
 *  Emergency Fund           15%   min(1, liquidSavings / (3 × avgMonthlyExpense))
 *
 * Score bands:
 *   ≥ 80  → Excellent
 *   ≥ 65  → Good
 *   ≥ 50  → Fair
 *   ≥ 35  → Needs Work
 *    < 35  → Poor
 */

const Transaction     = require('../../models/Transaction');
const Budget          = require('../../models/Budget');
const ScheduledPayment= require('../../models/ScheduledPayment');
const Account         = require('../../models/Account');

// ── Constants ─────────────────────────────────────────────────────────────────

const WEIGHTS = {
  savingsRate:      0.25,
  budgetAdherence:  0.25,
  paymentHistory:   0.20,
  debtToIncome:     0.15,
  emergencyFund:    0.15,
};

const SCORE_BANDS = [
  { min: 80, label: 'Excellent' },
  { min: 65, label: 'Good'      },
  { min: 50, label: 'Fair'      },
  { min: 35, label: 'Needs Work'},
  { min:  0, label: 'Poor'      },
];

function scoreBand(score) {
  return SCORE_BANDS.find((b) => score >= b.min)?.label ?? 'Poor';
}

// ── Component calculators ─────────────────────────────────────────────────────

/**
 * Savings Rate (0-100)
 * Uses the past 30 days of credit (income) and debit (expenses).
 * If income = 0, score = 0 (can't save what you don't earn).
 * savingsRate = (income - expenses) / income
 * Score = clamp(savingsRate, 0, 1) × 100
 *   — negative savingsRate → 0
 *   — savingsRate ≥ 0.20 (20% savings) → 100
 */
async function calcSavingsRate(userId) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [rows] = await Transaction.aggregate([
    {
      $match: {
        userId,
        date:      { $gte: since },
        deletedAt: null,
        type:      { $in: ['credit', 'debit', 'fee'] },
      },
    },
    {
      $group: {
        _id: null,
        income:   { $sum: { $cond: [{ $in: ['$type', ['credit', 'refund']] }, { $abs: '$amount' }, 0] } },
        expenses: { $sum: { $cond: [{ $in: ['$type', ['debit', 'fee']] },     { $abs: '$amount' }, 0] } },
      },
    },
  ]);

  if (!rows || rows.income === 0) return { score: 0, income: 0, expenses: 0, savingsRate: 0 };

  const { income, expenses } = rows;
  const savingsRate = Math.max(0, (income - expenses) / income);
  // Full score at ≥ 20 % savings rate
  const score = Math.min(100, (savingsRate / 0.20) * 100);

  return { score, income, expenses, savingsRate };
}

/**
 * Budget Adherence (0-100)
 * Counts active budgets for the current month.
 * adherenceRatio = categories within limit / total categories
 * Score = adherenceRatio × 100
 * If no budgets exist, score = 60 (neutral assumption).
 */
async function calcBudgetAdherence(userId) {
  const budgets = await Budget.find({ userId, deletedAt: null, isActive: true }).lean();

  if (!budgets.length) return { score: 60, total: 0, withinLimit: 0, adherenceRatio: null };

  const categories = budgets.flatMap((b) => b.categories || []);
  if (!categories.length) return { score: 60, total: 0, withinLimit: 0, adherenceRatio: null };

  const withinLimit = categories.filter((c) => (c.spent || 0) <= c.limit).length;
  const adherenceRatio = withinLimit / categories.length;
  const score = adherenceRatio * 100;

  return { score, total: categories.length, withinLimit, adherenceRatio };
}

/**
 * Payment History (0-100)
 * Looks at ScheduledPayment execution history over the past 90 days.
 * paymentScore = successfulPayments / totalAttempts
 * If no history, score = 70 (neutral).
 */
async function calcPaymentHistory(userId) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const payments = await ScheduledPayment.find({ userId, deletedAt: null }).lean();
  if (!payments.length) return { score: 70, total: 0, successful: 0 };

  let total = 0;
  let successful = 0;

  for (const p of payments) {
    for (const entry of (p.executionHistory || [])) {
      if (new Date(entry.attemptedAt) >= since) {
        total += 1;
        if (entry.status === 'success') successful += 1;
      }
    }
  }

  if (total === 0) return { score: 70, total: 0, successful: 0 };

  const score = (successful / total) * 100;
  return { score, total, successful };
}

/**
 * Debt-to-Income (0-100)
 * Uses Account balances: negative balance = debt.
 * dti = totalDebt / max(1, monthlyIncome)
 * score = clamp(1 - min(1, dti / 0.36), 0, 1) × 100
 *   — dti ≤ 0.36 (36% guideline) → score approaches 100
 *   — dti ≥ 1.0  → score = 0
 */
async function calcDebtToIncome(userId, monthlyIncome) {
  const accounts = await Account.find({ userId, deletedAt: null }).lean();

  const totalDebt = accounts.reduce((sum, a) => {
    return sum + (a.currentBalance < 0 ? Math.abs(a.currentBalance) : 0);
  }, 0);

  const safeIncome = Math.max(1, monthlyIncome);
  const dti        = totalDebt / safeIncome;
  // Full score when dti = 0, zero score when dti ≥ 0.36 (36% guideline)
  const score      = Math.max(0, Math.min(100, (1 - dti / 0.36) * 100));

  return { score, totalDebt, dti };
}

/**
 * Emergency Fund (0-100)
 * Liquid savings = sum of positive-balance savings/checking accounts.
 * Target = 3 × avgMonthlyExpense (3-month emergency rule).
 * score = clamp(liquidSavings / target, 0, 1) × 100
 * If no expense data, score = 40 (neutral).
 */
async function calcEmergencyFund(userId, avgMonthlyExpense) {
  const accounts = await Account.find({ userId, deletedAt: null,
    accountType: { $in: ['checking', 'savings'] } }).lean();

  const liquidSavings = accounts.reduce((sum, a) => {
    return sum + (a.currentBalance > 0 ? a.currentBalance : 0);
  }, 0);

  if (!avgMonthlyExpense || avgMonthlyExpense <= 0) {
    return { score: 40, liquidSavings, target: null, monthsCovered: null };
  }

  const target       = avgMonthlyExpense * 3;
  const ratio        = liquidSavings / target;
  const score        = Math.min(100, ratio * 100);
  const monthsCovered= liquidSavings / avgMonthlyExpense;

  return { score, liquidSavings, target, monthsCovered };
}

// ── Advice generator ─────────────────────────────────────────────────────────

function generateAdvice(components) {
  const advice = [];

  if (components.savingsRate.score < 50) {
    advice.push('Consider reducing discretionary spending to build a savings buffer of at least 20% of income.');
  }
  if (components.budgetAdherence.score < 70) {
    advice.push('Several spending categories have exceeded their budget limits. Review and adjust your budgets.');
  }
  if (components.paymentHistory.score < 80) {
    advice.push('Missed or failed scheduled payments are hurting your score. Ensure sufficient account balance before due dates.');
  }
  if (components.debtToIncome.score < 60) {
    advice.push('Your debt-to-income ratio is high. Focus on paying down high-interest debt first.');
  }
  if (components.emergencyFund.score < 50) {
    advice.push('Your emergency fund covers fewer than 3 months of expenses. Prioritise building this safety net.');
  }

  if (!advice.length) {
    advice.push('Your finances are in great shape! Keep up the consistent saving and spending habits.');
  }

  return advice;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute the full health score for a user.
 *
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<{
 *   score: number,
 *   label: string,
 *   components: Array<{key, label, score, weight}>,
 *   rawComponents: object,
 *   advice: string[],
 *   computedAt: Date,
 * }>}
 */
async function calculateHealthScore(userId) {
  // Run all component queries in parallel
  const [savings, budgetData, paymentData] = await Promise.all([
    calcSavingsRate(userId),
    calcBudgetAdherence(userId),
    calcPaymentHistory(userId),
  ]);

  // Use monthly income derived from savings calc
  const monthlyIncome   = savings.income;
  const monthlyExpense  = savings.expenses;

  const [debtData, efData] = await Promise.all([
    calcDebtToIncome(userId, monthlyIncome),
    calcEmergencyFund(userId, monthlyExpense),
  ]);

  const raw = {
    savingsRate:     savings,
    budgetAdherence: budgetData,
    paymentHistory:  paymentData,
    debtToIncome:    debtData,
    emergencyFund:   efData,
  };

  // Weighted composite score (0-100)
  const composite =
    raw.savingsRate.score     * WEIGHTS.savingsRate    +
    raw.budgetAdherence.score * WEIGHTS.budgetAdherence +
    raw.paymentHistory.score  * WEIGHTS.paymentHistory  +
    raw.debtToIncome.score    * WEIGHTS.debtToIncome    +
    raw.emergencyFund.score   * WEIGHTS.emergencyFund;

  const score = Math.round(Math.min(100, Math.max(0, composite)));
  const label = scoreBand(score);

  // Normalised component array for the frontend ring chart
  const components = [
    { key: 'savingsRate',     label: 'Savings Rate',     score: Math.round(raw.savingsRate.score),     weight: WEIGHTS.savingsRate    * 100 },
    { key: 'budgetAdherence', label: 'Budget Adherence', score: Math.round(raw.budgetAdherence.score), weight: WEIGHTS.budgetAdherence * 100 },
    { key: 'paymentHistory',  label: 'Payment History',  score: Math.round(raw.paymentHistory.score),  weight: WEIGHTS.paymentHistory  * 100 },
    { key: 'debtToIncome',    label: 'Debt-to-Income',   score: Math.round(raw.debtToIncome.score),    weight: WEIGHTS.debtToIncome    * 100 },
    { key: 'emergencyFund',   label: 'Emergency Fund',   score: Math.round(raw.emergencyFund.score),   weight: WEIGHTS.emergencyFund   * 100 },
  ];

  const advice = generateAdvice(raw);

  return {
    score,
    label,
    components,
    rawComponents: raw,
    advice,
    computedAt: new Date(),
  };
}

module.exports = { calculateHealthScore, WEIGHTS, scoreBand };
