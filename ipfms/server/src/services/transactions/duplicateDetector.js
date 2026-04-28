const Transaction = require('../../models/Transaction');

/**
 * Duplicate Detector — Algorithm 5.2
 *
 * A transaction is flagged as a duplicate if ANY of the following are true:
 *
 *   Strategy A — External ID match (strongest signal):
 *     Same externalId + same accountId.
 *
 *   Strategy B — Fingerprint match (for manual/imported transactions):
 *     Same accountId + same amount + same date (±1 day) + same description
 *     fingerprint (normalised, first 40 chars), within the dedup window.
 *
 * The detector returns both whether a duplicate exists and, if so, the ID
 * of the original so the Transaction schema's duplicateOf field can be set.
 */

const DEDUP_WINDOW_DAYS = 5; // look back this many days for fingerprint matches

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether a candidate transaction is a duplicate of an existing one.
 *
 * @param {object} candidate
 * @param {string}  candidate.accountId
 * @param {number}  candidate.amount
 * @param {Date}    candidate.date
 * @param {string}  candidate.description
 * @param {string}  [candidate.externalId]   Provider transaction ID
 * @param {string}  [candidate.excludeId]    Mongo _id to exclude (for update checks)
 *
 * @returns {Promise<{ isDuplicate: boolean, duplicateOf: string|null }>}
 */
async function checkDuplicate(candidate) {
  // Strategy A — External ID (definitive)
  if (candidate.externalId) {
    const externalMatch = await Transaction.findOne({
      accountId: candidate.accountId,
      externalId: candidate.externalId,
      deletedAt: null,
      ...(candidate.excludeId && { _id: { $ne: candidate.excludeId } }),
    }).select('_id');

    if (externalMatch) {
      return { isDuplicate: true, duplicateOf: externalMatch._id.toString() };
    }
  }

  // Strategy B — Normalised fingerprint match
  // We compare the normalised fingerprint stored on the existing document
  // against the fingerprint of the incoming candidate.  This avoids the
  // brittleness of applying a regex to raw bank descriptions (which often
  // start with noise words like "POS PURCHASE" that would defeat a ^ anchor).
  const fingerprint = buildFingerprint(candidate.description);
  const dateFrom = new Date(candidate.date);
  dateFrom.setDate(dateFrom.getDate() - DEDUP_WINDOW_DAYS);
  const dateTo = new Date(candidate.date);
  dateTo.setDate(dateTo.getDate() + 1);

  const fingerprintMatch = await Transaction.findOne({
    accountId: candidate.accountId,
    amount: candidate.amount,
    date: { $gte: dateFrom, $lte: dateTo },
    descriptionFingerprint: fingerprint,
    deletedAt: null,
    ...(candidate.excludeId && { _id: { $ne: candidate.excludeId } }),
  }).select('_id');

  if (fingerprintMatch) {
    return { isDuplicate: true, duplicateOf: fingerprintMatch._id.toString() };
  }

  return { isDuplicate: false, duplicateOf: null };
}

/**
 * Run duplicate detection on an array of candidate transactions.
 * Useful during bulk bank-sync imports.
 *
 * @param {Array<object>} candidates
 * @returns {Promise<Array<{ isDuplicate: boolean, duplicateOf: string|null }>>}
 */
async function checkBatch(candidates) {
  return Promise.all(candidates.map((c) => checkDuplicate(c)));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a description into a stable fingerprint for fuzzy matching.
 * Strips noise words, punctuation, extra whitespace, then takes first 40 chars.
 * @param {string} description
 * @returns {string}
 */
function buildFingerprint(description) {
  return description
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|co|corp|the|a|an|pos|purchase|debit|payment|pymt|ref|#\w+)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

module.exports = { checkDuplicate, checkBatch, buildFingerprint };
