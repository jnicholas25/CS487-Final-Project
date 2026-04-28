/**
 * Z-Score Detector — Step 5 / Algorithm 5.3 (Anomaly Detection Engine)
 *
 * computeZScore(userId, category, amount, sampleSize = 30)
 *
 *   Fetches the last `sampleSize` non-deleted, non-duplicate debit transactions
 *   in the same category for this user and computes the Z-score for the given
 *   `amount` relative to that historical baseline.
 *
 *   Returns:
 *     { zScore, mean, stdDev, sampleSize: actual, reliable }
 *
 *   reliable = true when the actual sample size is ≥ MIN_RELIABLE_SAMPLES (5).
 *   zScore   = null when stdDev = 0 (all historical amounts are identical) or
 *              when there is no history.
 *
 * Formula: z = (x − μ) / σ
 *   where μ = mean of historical amounts, σ = population standard deviation.
 */

const Transaction = require('../../models/Transaction');

const MIN_RELIABLE_SAMPLES = 5;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the Z-score of `amount` within the user's historical spending for
 * the given category.
 *
 * @param {string} userId
 * @param {string} category    Transaction category string (e.g. 'Dining & Restaurants')
 * @param {number} amount      The transaction amount to evaluate.
 * @param {number} [sampleSize=30]  Max history length.
 * @returns {Promise<{
 *   zScore: number|null,
 *   mean: number|null,
 *   stdDev: number|null,
 *   sampleSize: number,
 *   reliable: boolean
 * }>}
 */
async function computeZScore(userId, category, amount, sampleSize = 30) {
  const history = await Transaction.find({
    userId,
    category,
    type: 'debit',
    deletedAt: null,
    isDuplicate: false,
  })
    .sort({ date: -1 })
    .limit(sampleSize)
    .select('amount')
    .lean();

  const n = history.length;
  const reliable = n >= MIN_RELIABLE_SAMPLES;

  if (n === 0) {
    return { zScore: null, mean: null, stdDev: null, sampleSize: 0, reliable: false };
  }

  const amounts = history.map((t) => t.amount);

  // Population mean
  const mean = amounts.reduce((sum, v) => sum + v, 0) / n;

  // Population standard deviation
  const variance = amounts.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  // Guard: division by zero when all amounts are identical
  const zScore = stdDev === 0 ? null : (amount - mean) / stdDev;

  return {
    zScore,
    mean,
    stdDev,
    sampleSize: n,
    reliable,
  };
}

module.exports = { computeZScore };
