/**
 * Alert Routes — Step 5 / Algorithm 5.3 (Anomaly Detection Engine)
 *
 * All routes require authentication.
 *
 * IMPORTANT: POST /scan is registered BEFORE GET /:id to prevent Express
 * from treating the literal segment "scan" as a MongoId parameter.
 */

const express = require('express');
const router  = express.Router();

const alertController = require('../controllers/alertController');
const { protect }     = require('../middleware/authMiddleware');
const { validate }    = require('../validators/authValidator');
const {
  idParamRules,
  listAlertRules,
  resolveAlertRules,
  scanRules,
} = require('../validators/alertValidator');

// All alert routes require authentication
router.use(protect);

/**
 * GET /api/v1/alerts
 * List the user's anomaly alerts.
 * Query params: status, severity, alertType, page, limit, sortBy, sortOrder
 */
router.get('/', listAlertRules, validate, alertController.list);

/**
 * POST /api/v1/alerts/scan
 * Trigger an on-demand anomaly scan for recent transactions.
 * Must be registered BEFORE /:id.
 * Body: { lookbackHours?: number }
 */
router.post('/scan', scanRules, validate, alertController.scan);

/**
 * GET /api/v1/alerts/:id
 * Retrieve a single alert by ID.
 */
router.get('/:id', idParamRules, validate, alertController.getOne);

/**
 * PATCH /api/v1/alerts/:id/acknowledge
 * Acknowledge an open alert (open → acknowledged).
 */
router.patch('/:id/acknowledge', idParamRules, validate, alertController.acknowledge);

/**
 * PATCH /api/v1/alerts/:id/resolve
 * Resolve an alert with a feedback action (confirmed_fraud, false_positive, etc.)
 * This drives the Algorithm 5.3 feedback loop.
 */
router.patch('/:id/resolve', resolveAlertRules, validate, alertController.resolve);

/**
 * PATCH /api/v1/alerts/:id/dismiss
 * Dismiss an alert without formal resolution.
 */
router.patch('/:id/dismiss', idParamRules, validate, alertController.dismiss);

module.exports = router;
