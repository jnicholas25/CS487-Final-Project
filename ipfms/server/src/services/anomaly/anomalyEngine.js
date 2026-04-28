/**
 * Anomaly Engine — Step 5 / Algorithm 5.3 (Anomaly Detection Engine)
 *
 * Implements three detection rules:
 *
 *   1. unusual_amount  — Z-score on the last 30 same-category debits.
 *                        |z| ≥ 2.0 → medium, ≥ 3.5 → high, ≥ 5.0 → critical.
 *                        Requires ≥ 5 history samples to be considered reliable.
 *
 *   2. large_transfer  — Any transaction ≥ $1 000.
 *                        amount ≥ $5 000 → high severity, otherwise medium.
 *                        Both directions (debit and credit) are checked.
 *
 *   3. rapid_succession — ≥ 3 transactions on the same account within a 60-minute
 *                        sliding window centred on the transaction date → high.
 *
 * For each triggered rule:
 *   - An AnomalyAlert document is created (deduplicated by transactionId + alertType).
 *   - The transaction's anomalyAlertId is set to the first new alert created.
 *   - For high/critical severity alerts the transaction is flagged (isFlagged = true,
 *     fraudMeta populated) so it surfaces in the fraud-flagged transaction list.
 *
 * Public API:
 *   analyzeTransaction(userId, transactionDoc) → { alerts, transactionId }
 *   scanRecentTransactions(userId, lookbackHours = 24) → { txScanned, alertsCreated }
 */

const Transaction  = require('../../models/Transaction');
const AnomalyAlert = require('../../models/AnomalyAlert');
const { computeZScore } = require('./zScoreDetector');
const logger = require('../../utils/logger');

// ── Thresholds ────────────────────────────────────────────────────────────────

const Z_MEDIUM_THRESHOLD   = 2.0;
const Z_HIGH_THRESHOLD     = 3.5;
const Z_CRITICAL_THRESHOLD = 5.0;

const LARGE_TRANSFER_THRESHOLD      = 1000;   // medium severity
const LARGE_TRANSFER_HIGH_THRESHOLD = 5000;   // high severity

const RAPID_SUCCESSION_COUNT      = 3;    // minimum tx count to trigger
const RAPID_SUCCESSION_WINDOW_MIN = 60;   // window in minutes

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run all detection rules against a single transaction document.
 *
 * @param {string|ObjectId} userId
 * @param {Transaction}     transactionDoc   Mongoose document (not lean).
 * @returns {Promise<{ alerts: AnomalyAlert[], transactionId: ObjectId }>}
 */
async function analyzeTransaction(userId, transactionDoc) {
  const created = [];

  // ── Rule 1: Z-score unusual_amount (debits only) ──────────────────────────
  if (transactionDoc.type === 'debit') {
    const { zScore, mean, stdDev, sampleSize, reliable } = await computeZScore(
      userId,
      transactionDoc.category,
      transactionDoc.amount
    );

    if (reliable && zScore !== null && Math.abs(zScore) >= Z_MEDIUM_THRESHOLD) {
      const existing = await AnomalyAlert.findOne({
        transactionId: transactionDoc._id,
        alertType: 'unusual_amount',
        deletedAt: null,
      });

      if (!existing) {
        const severity    = _zScoreSeverity(zScore);
        const anomalyScore = _normalizeZScore(Math.abs(zScore));

        const alert = await AnomalyAlert.create({
          userId,
          accountId:     transactionDoc.accountId,
          transactionId: transactionDoc._id,
          alertType:     'unusual_amount',
          severity,
          title: 'Unusual transaction amount detected',
          description: `A ${transactionDoc.category} transaction of $${transactionDoc.amount.toFixed(2)} is ${Math.abs(zScore).toFixed(1)}σ from your typical spend of $${mean.toFixed(2)}.`,
          recommendation: 'Review this transaction and confirm whether it is expected.',
          detectionMeta: {
            zScore,
            anomalyScore,
            baseline:       mean,
            deviation:      transactionDoc.amount - mean,
            detectionRule:  'z_score_amount',
            featureVector: new Map([
              ['amount',     transactionDoc.amount],
              ['mean',       mean],
              ['stdDev',     stdDev],
              ['sampleSize', sampleSize],
            ]),
          },
        });

        created.push(alert);
        if (severity === 'high' || severity === 'critical') {
          await _flagTransaction(transactionDoc, zScore, anomalyScore);
        }
      }
    }
  }

  // ── Rule 2: Large transfer ────────────────────────────────────────────────
  if (Math.abs(transactionDoc.amount) >= LARGE_TRANSFER_THRESHOLD) {
    const existing = await AnomalyAlert.findOne({
      transactionId: transactionDoc._id,
      alertType: 'large_transfer',
      deletedAt: null,
    });

    if (!existing) {
      const abs      = Math.abs(transactionDoc.amount);
      const severity = abs >= LARGE_TRANSFER_HIGH_THRESHOLD ? 'high' : 'medium';
      const anomalyScore = Math.min(abs / 10000, 1);

      const alert = await AnomalyAlert.create({
        userId,
        accountId:     transactionDoc.accountId,
        transactionId: transactionDoc._id,
        alertType:     'large_transfer',
        severity,
        title: `Large transaction of $${abs.toFixed(2)}`,
        description: `A transaction of $${abs.toFixed(2)} (${transactionDoc.description}) exceeds the large-transfer threshold of $${LARGE_TRANSFER_THRESHOLD.toLocaleString()}.`,
        recommendation: 'Verify you authorised this transaction.',
        detectionMeta: {
          zScore:        null,
          anomalyScore,
          baseline:      LARGE_TRANSFER_THRESHOLD,
          deviation:     abs - LARGE_TRANSFER_THRESHOLD,
          detectionRule: 'large_transfer',
        },
      });

      created.push(alert);
      if (severity === 'high') {
        await _flagTransaction(transactionDoc, null, anomalyScore);
      }
    }
  }

  // ── Rule 3: Rapid succession ──────────────────────────────────────────────
  const txDate      = new Date(transactionDoc.date);
  const windowStart = new Date(txDate.getTime() - RAPID_SUCCESSION_WINDOW_MIN * 60 * 1000);
  const windowEnd   = new Date(txDate.getTime() + RAPID_SUCCESSION_WINDOW_MIN * 60 * 1000);

  const nearbyCount = await Transaction.countDocuments({
    accountId:  transactionDoc.accountId,
    date:       { $gte: windowStart, $lte: windowEnd },
    deletedAt:  null,
    _id:        { $ne: transactionDoc._id },
  });

  const totalCount = nearbyCount + 1; // include the current transaction

  if (totalCount >= RAPID_SUCCESSION_COUNT) {
    const existing = await AnomalyAlert.findOne({
      transactionId: transactionDoc._id,
      alertType: 'rapid_succession',
      deletedAt: null,
    });

    if (!existing) {
      const anomalyScore = Math.min(totalCount / 10, 1);

      const alert = await AnomalyAlert.create({
        userId,
        accountId:     transactionDoc.accountId,
        transactionId: transactionDoc._id,
        alertType:     'rapid_succession',
        severity:      'high',
        title: `${totalCount} transactions in a 60-minute window`,
        description: `${totalCount} transactions were detected on this account within ${RAPID_SUCCESSION_WINDOW_MIN} minutes, which may indicate unauthorised activity.`,
        recommendation: 'Review all recent transactions on this account.',
        detectionMeta: {
          zScore:        null,
          anomalyScore,
          baseline:      RAPID_SUCCESSION_COUNT - 1,
          deviation:     totalCount - (RAPID_SUCCESSION_COUNT - 1),
          detectionRule: 'rapid_succession',
          featureVector: new Map([
            ['transactionCount', totalCount],
            ['windowMinutes',    RAPID_SUCCESSION_WINDOW_MIN],
          ]),
        },
      });

      created.push(alert);
      await _flagTransaction(transactionDoc, null, anomalyScore);
    }
  }

  // Link the first new alert to the transaction if not already linked
  if (created.length > 0 && !transactionDoc.anomalyAlertId) {
    await Transaction.updateOne(
      { _id: transactionDoc._id },
      { $set: { anomalyAlertId: created[0]._id } }
    );
  }

  return { alerts: created, transactionId: transactionDoc._id };
}

/**
 * Scan all transactions created within the last `lookbackHours` hours for
 * anomalies.  Existing alerts are deduplicated inside analyzeTransaction.
 *
 * @param {string|ObjectId} userId
 * @param {number} [lookbackHours=24]
 * @returns {Promise<{ txScanned: number, alertsCreated: number }>}
 */
async function scanRecentTransactions(userId, lookbackHours = 24) {
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const transactions = await Transaction.find({
    userId,
    date:        { $gte: since },
    deletedAt:   null,
    isDuplicate: false,
  }).sort({ date: 1 }); // oldest first so rapid-succession counts are stable

  let txScanned    = 0;
  let alertsCreated = 0;

  for (const tx of transactions) {
    txScanned++;
    try {
      const { alerts } = await analyzeTransaction(userId, tx);
      alertsCreated += alerts.length;
    } catch (err) {
      logger.error(`[AnomalyEngine] Error scanning transaction ${tx._id}: ${err.message}`);
    }
  }

  logger.info(`[AnomalyEngine] Scan complete — ${txScanned} transactions, ${alertsCreated} alerts created`);
  return { txScanned, alertsCreated };
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Map absolute Z-score to severity level.
 */
function _zScoreSeverity(zScore) {
  const abs = Math.abs(zScore);
  if (abs >= Z_CRITICAL_THRESHOLD) return 'critical';
  if (abs >= Z_HIGH_THRESHOLD)     return 'high';
  return 'medium';
}

/**
 * Normalise an absolute Z-score to a 0–1 anomaly score.
 * Maps 0 → 0, 5 → 1 (clamped).
 */
function _normalizeZScore(absZ) {
  return Math.min(absZ / 5, 1);
}

/**
 * Mark a transaction as fraud-flagged (system-generated).
 * Only touches fraud metadata — does not change the transaction amount or type.
 *
 * @param {Transaction}  transactionDoc
 * @param {number|null}  zScore
 * @param {number}       anomalyScore
 */
async function _flagTransaction(transactionDoc, zScore, anomalyScore) {
  await Transaction.updateOne(
    { _id: transactionDoc._id },
    {
      $set: {
        isFlagged:                  true,
        'fraudMeta.zScore':         zScore,
        'fraudMeta.anomalyScore':   anomalyScore,
        'fraudMeta.flaggedAt':      new Date(),
        'fraudMeta.flaggedBy':      'system',
      },
    }
  );
}

module.exports = { analyzeTransaction, scanRecentTransactions };
