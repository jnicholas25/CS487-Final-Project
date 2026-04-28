/**
 * Alert Controller — Step 5 / Algorithm 5.3 (Anomaly Detection Engine)
 *
 * Handlers:
 *   list        GET  /api/v1/alerts
 *   scan        POST /api/v1/alerts/scan
 *   getOne      GET  /api/v1/alerts/:id
 *   acknowledge PATCH /api/v1/alerts/:id/acknowledge
 *   resolve     PATCH /api/v1/alerts/:id/resolve  (feedback loop)
 *   dismiss     PATCH /api/v1/alerts/:id/dismiss
 *
 * The controller is decoupled from HTTP; business logic lives in anomalyEngine.
 */

const AnomalyAlert  = require('../models/AnomalyAlert');
const Transaction   = require('../models/Transaction');
const { scanRecentTransactions } = require('../services/anomaly/anomalyEngine');
const { AppError }  = require('../middleware/errorHandler');
const logger        = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find an alert that belongs to the authenticated user or throw 404.
 */
async function _findAlert(alertId, userId) {
  const alert = await AnomalyAlert.findOne({
    _id:       alertId,
    userId,
    deletedAt: null,
  });
  if (!alert) throw new AppError('Alert not found', 404, 'ALERT_NOT_FOUND');
  return alert;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/alerts
 * List the current user's anomaly alerts with optional filtering.
 */
async function list(req, res, next) {
  try {
    const userId = req.user._id;
    const {
      status,
      severity,
      alertType,
      page      = 1,
      limit     = 20,
      sortBy    = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = { userId, deletedAt: null };
    if (status)    filter.status    = status;
    if (severity)  filter.severity  = severity;
    if (alertType) filter.alertType = alertType;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [alerts, total] = await Promise.all([
      AnomalyAlert.find(filter).sort(sort).skip(skip).limit(parseInt(limit, 10)),
      AnomalyAlert.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        alerts,
        total,
        page:  parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/alerts/:id
 * Retrieve a single alert by ID.
 */
async function getOne(req, res, next) {
  try {
    const alert = await _findAlert(req.params.id, req.user._id);
    res.json({ success: true, data: { alert } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/alerts/scan
 * Trigger an on-demand anomaly scan over the user's recent transactions.
 *
 * Body: { lookbackHours?: number }  (default 24, max 168)
 */
async function scan(req, res, next) {
  try {
    const userId        = req.user._id.toString();
    const lookbackHours = parseInt(req.body.lookbackHours, 10) || 24;

    const result = await scanRecentTransactions(userId, lookbackHours);
    logger.info(`[AlertController] Scan for user ${userId}: ${result.alertsCreated} alerts, ${result.txScanned} tx`);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/alerts/:id/acknowledge
 * Acknowledge an open alert.  Moves status open → acknowledged.
 */
async function acknowledge(req, res, next) {
  try {
    const alert = await _findAlert(req.params.id, req.user._id);

    if (alert.status !== 'open') {
      return next(
        new AppError(
          `Cannot acknowledge an alert with status "${alert.status}"`,
          409,
          'ALERT_NOT_OPEN'
        )
      );
    }

    alert.status         = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = req.user._id;
    await alert.save();

    res.json({ success: true, data: { alert } });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/alerts/:id/resolve
 * Resolve an alert with a user action.  Implements the Algorithm 5.3 feedback
 * loop: updates the linked transaction's fraud state accordingly.
 *
 * Body: { action: 'confirmed_fraud'|'false_positive'|'user_verified'|'auto_resolved', notes?: string }
 */
async function resolve(req, res, next) {
  try {
    const { action, notes } = req.body;
    const alert = await _findAlert(req.params.id, req.user._id);

    if (alert.status === 'resolved' || alert.status === 'dismissed') {
      return next(
        new AppError(`Alert is already ${alert.status}`, 409, 'ALERT_ALREADY_RESOLVED')
      );
    }

    // Persist resolution
    alert.status     = 'resolved';
    alert.resolution = {
      resolvedAt: new Date(),
      resolvedBy: req.user._id,
      action,
      notes: notes || null,
    };
    await alert.save();

    // ── Feedback loop: update the linked transaction ──────────────────────────
    if (alert.transactionId) {
      if (action === 'confirmed_fraud') {
        // User confirms this is fraud — ensure the transaction is flagged
        await Transaction.updateOne(
          { _id: alert.transactionId },
          {
            $set: {
              isFlagged:                     true,
              'fraudMeta.flaggedBy':         'user',
              'fraudMeta.flaggedAt':         new Date(),
              'fraudMeta.resolutionNote':    notes || null,
            },
          }
        );
      } else if (action === 'false_positive') {
        // User says this is legitimate — clear the flag
        await Transaction.updateOne(
          { _id: alert.transactionId },
          {
            $set: {
              isFlagged:                     false,
              'fraudMeta.resolvedAt':        new Date(),
              'fraudMeta.resolutionNote':    notes || 'Marked as false positive',
            },
          }
        );
      }
      // user_verified / auto_resolved: no transaction update required
    }

    logger.info(`[AlertController] Alert ${alert._id} resolved with action="${action}" by user ${req.user._id}`);
    res.json({ success: true, data: { alert } });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/alerts/:id/dismiss
 * Dismiss an open or acknowledged alert without a formal resolution.
 */
async function dismiss(req, res, next) {
  try {
    const alert = await _findAlert(req.params.id, req.user._id);

    if (alert.status === 'resolved' || alert.status === 'dismissed') {
      return next(
        new AppError(`Alert is already ${alert.status}`, 409, 'ALERT_ALREADY_RESOLVED')
      );
    }

    alert.status = 'dismissed';
    await alert.save();

    res.json({ success: true, data: { alert } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, scan, acknowledge, resolve, dismiss };
