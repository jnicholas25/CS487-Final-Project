/**
 * Performance Calculator — Step 7 (Investment Tracker)
 *
 * Computes return metrics for individual holdings and the full portfolio.
 *
 * Metrics:
 *   totalReturn       — (currentValue − costBasis) + dividendIncome
 *   totalReturnPct    — totalReturn / costBasis × 100
 *   annualizedReturnPct — CAGR = ((finalValue / costBasis) ^ (1/years)) − 1) × 100
 *                         only calculated when purchaseDate is set and years > 0
 *
 * Holdings without a currentPrice can still report dividend-only returns.
 */

const Investment = require('../../models/Investment');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calculate return metrics for a single holding document.
 *
 * @param {Investment} holding   Mongoose document (not lean).
 * @returns {{
 *   totalReturn: number|null,
 *   totalReturnPct: number|null,
 *   annualizedReturnPct: number|null,
 * }}
 */
function calculateHoldingReturn(holding) {
  const costBasis = holding.quantity * holding.averageCostBasis;
  if (costBasis === 0) {
    return { totalReturn: null, totalReturnPct: null, annualizedReturnPct: null };
  }

  const currentValue    = holding.currentPrice != null
    ? holding.quantity * holding.currentPrice
    : null;
  const dividendIncome  = holding.dividends.reduce((s, d) => s + d.amount, 0);

  if (currentValue === null) {
    // Only dividend-based return is computable
    const totalReturn    = dividendIncome;
    const totalReturnPct = (totalReturn / costBasis) * 100;
    return { totalReturn: _round(totalReturn), totalReturnPct: _round(totalReturnPct), annualizedReturnPct: null };
  }

  const totalReturn    = (currentValue - costBasis) + dividendIncome;
  const totalReturnPct = (totalReturn / costBasis) * 100;

  // CAGR — only meaningful when purchaseDate is known and > 0 years have elapsed
  let annualizedReturnPct = null;
  if (holding.purchaseDate) {
    const msElapsed = Date.now() - new Date(holding.purchaseDate).getTime();
    const years     = msElapsed / (365.25 * 24 * 60 * 60 * 1000);
    if (years > 0.01) {
      // Total value including dividends (simple CAGR approximation)
      const finalValue      = currentValue + dividendIncome;
      annualizedReturnPct   = (Math.pow(finalValue / costBasis, 1 / years) - 1) * 100;
    }
  }

  return {
    totalReturn:         _round(totalReturn),
    totalReturnPct:      _round(totalReturnPct),
    annualizedReturnPct: annualizedReturnPct != null ? _round(annualizedReturnPct) : null,
  };
}

/**
 * Compute per-holding and aggregate portfolio performance for a user.
 *
 * @param {string|ObjectId} userId
 * @returns {Promise<{
 *   holdings: object[],
 *   portfolio: { totalInvested, totalReturn, totalReturnPct }
 * }>}
 */
async function calculatePortfolioPerformance(userId) {
  const holdings = await Investment.find({ userId, isActive: true, deletedAt: null });

  let aggCostBasis   = 0;
  let aggTotalReturn = 0;
  let hasTotalReturn = false;

  const rows = holdings.map((h) => {
    const perf     = calculateHoldingReturn(h);
    const costBasis = h.quantity * h.averageCostBasis;
    aggCostBasis   += costBasis;
    if (perf.totalReturn != null) {
      aggTotalReturn += perf.totalReturn;
      hasTotalReturn  = true;
    }

    return {
      _id:                h._id,
      symbol:             h.symbol,
      name:               h.name,
      assetType:          h.assetType,
      totalCostBasis:     _round(costBasis),
      ...perf,
    };
  });

  const portfolioTotalReturnPct = hasTotalReturn && aggCostBasis > 0
    ? _round((aggTotalReturn / aggCostBasis) * 100)
    : null;

  return {
    holdings: rows,
    portfolio: {
      totalInvested:    _round(aggCostBasis),
      totalReturn:      hasTotalReturn ? _round(aggTotalReturn) : null,
      totalReturnPct:   portfolioTotalReturnPct,
    },
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { calculateHoldingReturn, calculatePortfolioPerformance };
