/**
 * Dividend Tracker — Step 7 (Investment Tracker)
 *
 * addDividend(holdingId, userId, data)
 *   Appends a dividend record to the holding's embedded array.
 *
 * getDividendSummary(userId)
 *   Returns all-time and year-to-date dividend totals, broken down per holding.
 *
 * getDividendHistory(userId, opts)
 *   Returns a flat, date-sorted list of all dividend events across all holdings.
 */

const Investment = require('../../models/Investment');
const { AppError } = require('../../middleware/errorHandler');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add a dividend record to an existing holding.
 *
 * @param {string} holdingId
 * @param {string} userId
 * @param {{ amount: number, date: string|Date, type?: string, notes?: string }} data
 * @returns {Promise<Investment>}  The updated holding document.
 */
async function addDividend(holdingId, userId, { amount, date, type, notes }) {
  const holding = await Investment.findOne({
    _id:       holdingId,
    userId,
    deletedAt: null,
  });

  if (!holding) {
    throw new AppError('Investment holding not found', 404, 'INVESTMENT_NOT_FOUND');
  }

  holding.dividends.push({
    amount,
    date:  new Date(date),
    type:  type  || 'cash',
    notes: notes || null,
  });

  await holding.save();
  return holding;
}

/**
 * Summarise dividend income for a user.
 *
 * @param {string|ObjectId} userId
 * @returns {Promise<{
 *   totalAllTime: number,
 *   totalYTD: number,
 *   byHolding: { symbol, name, totalDividends, ytdDividends }[]
 * }>}
 */
async function getDividendSummary(userId) {
  const holdings = await Investment
    .find({ userId, deletedAt: null })
    .select('symbol name dividends');

  const ytdStart = new Date(new Date().getFullYear(), 0, 1); // Jan 1 this year

  let totalAllTime = 0;
  let totalYTD     = 0;
  const byHolding  = [];

  for (const h of holdings) {
    const allTime = h.dividends.reduce((s, d) => s + d.amount, 0);
    const ytd     = h.dividends
      .filter((d) => new Date(d.date) >= ytdStart)
      .reduce((s, d) => s + d.amount, 0);

    totalAllTime += allTime;
    totalYTD     += ytd;

    if (allTime > 0) {
      byHolding.push({
        symbol:         h.symbol,
        name:           h.name,
        totalDividends: _round(allTime),
        ytdDividends:   _round(ytd),
      });
    }
  }

  // Sort by total dividends descending
  byHolding.sort((a, b) => b.totalDividends - a.totalDividends);

  return {
    totalAllTime: _round(totalAllTime),
    totalYTD:     _round(totalYTD),
    byHolding,
  };
}

/**
 * Return a flat, date-sorted list of all dividend events across all holdings.
 *
 * @param {string|ObjectId} userId
 * @param {{ limit?: number, offset?: number }} opts
 * @returns {Promise<{ events: object[], total: number }>}
 */
async function getDividendHistory(userId, { limit = 50, offset = 0 } = {}) {
  const holdings = await Investment
    .find({ userId, deletedAt: null })
    .select('symbol name dividends');

  // Flatten all dividends into a single array
  const all = [];
  for (const h of holdings) {
    for (const d of h.dividends) {
      all.push({
        dividendId: d._id,
        symbol:     h.symbol,
        name:       h.name,
        amount:     d.amount,
        date:       d.date,
        type:       d.type,
        notes:      d.notes,
      });
    }
  }

  // Sort newest-first
  all.sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    events: all.slice(offset, offset + limit),
    total:  all.length,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { addDividend, getDividendSummary, getDividendHistory };
