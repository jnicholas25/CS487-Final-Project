/**
 * Portfolio Aggregator — Step 7 (Investment Tracker)
 *
 * getPortfolioSummary(userId)
 *   Loads all active holdings for the user, computes per-holding and
 *   portfolio-level metrics, and returns a structured summary object.
 *
 * Metrics computed:
 *   - currentValue     = quantity × currentPrice  (null if no price set)
 *   - totalCostBasis   = quantity × averageCostBasis
 *   - gainLoss         = currentValue − totalCostBasis
 *   - gainLossPct      = gainLoss / totalCostBasis × 100
 *   - totalDividends   = sum of all embedded dividend amounts
 *   - totalReturn      = gainLoss + totalDividends  (total economic return)
 */

const Investment = require('../../models/Investment');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute a full portfolio summary for a user.
 *
 * @param {string|ObjectId} userId
 * @returns {Promise<{
 *   holdings: object[],
 *   summary: {
 *     totalHoldings: number,
 *     totalCostBasis: number,
 *     totalCurrentValue: number|null,
 *     totalGainLoss: number|null,
 *     totalGainLossPct: number|null,
 *     totalDividendsReceived: number,
 *     estimatedTotalReturn: number|null,
 *   }
 * }>}
 */
async function getPortfolioSummary(userId) {
  const holdings = await Investment.find({
    userId,
    isActive:  true,
    deletedAt: null,
  }).sort({ symbol: 1 });

  let aggCostBasis     = 0;
  let aggCurrentValue  = 0;
  let aggDividends     = 0;
  let hasPrices        = false;

  const holdingRows = holdings.map((h) => {
    const costBasis     = h.quantity * h.averageCostBasis;
    const currentValue  = h.currentPrice != null ? h.quantity * h.currentPrice : null;
    const gainLoss      = currentValue != null ? currentValue - costBasis : null;
    const gainLossPct   = gainLoss != null && costBasis > 0
      ? (gainLoss / costBasis) * 100
      : null;
    const dividendTotal = h.dividends.reduce((s, d) => s + d.amount, 0);
    const totalReturn   = gainLoss != null ? gainLoss + dividendTotal : null;

    aggCostBasis    += costBasis;
    aggDividends    += dividendTotal;
    if (currentValue != null) {
      aggCurrentValue += currentValue;
      hasPrices = true;
    }

    return {
      _id:             h._id,
      symbol:          h.symbol,
      name:            h.name,
      assetType:       h.assetType,
      exchange:        h.exchange,
      currency:        h.currency,
      quantity:        h.quantity,
      averageCostBasis: h.averageCostBasis,
      currentPrice:    h.currentPrice,
      priceUpdatedAt:  h.priceUpdatedAt,
      totalCostBasis:  _round(costBasis),
      currentValue:    currentValue != null ? _round(currentValue) : null,
      gainLoss:        gainLoss     != null ? _round(gainLoss)     : null,
      gainLossPct:     gainLossPct  != null ? _round(gainLossPct)  : null,
      totalDividends:  _round(dividendTotal),
      totalReturn:     totalReturn  != null ? _round(totalReturn)  : null,
      purchaseDate:    h.purchaseDate,
    };
  });

  const totalGainLoss    = hasPrices ? aggCurrentValue - aggCostBasis : null;
  const totalGainLossPct = totalGainLoss != null && aggCostBasis > 0
    ? (totalGainLoss / aggCostBasis) * 100
    : null;
  const estimatedTotalReturn = totalGainLoss != null
    ? totalGainLoss + aggDividends
    : null;

  return {
    holdings: holdingRows,
    summary: {
      totalHoldings:          holdings.length,
      totalCostBasis:         _round(aggCostBasis),
      totalCurrentValue:      hasPrices ? _round(aggCurrentValue) : null,
      totalGainLoss:          totalGainLoss     != null ? _round(totalGainLoss)     : null,
      totalGainLossPct:       totalGainLossPct  != null ? _round(totalGainLossPct)  : null,
      totalDividendsReceived: _round(aggDividends),
      estimatedTotalReturn:   estimatedTotalReturn != null ? _round(estimatedTotalReturn) : null,
    },
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { getPortfolioSummary };
