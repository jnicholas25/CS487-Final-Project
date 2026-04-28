/**
 * Alert Validator — Step 5 / Algorithm 5.3 (Anomaly Detection Engine)
 *
 * Validation rule sets consumed by alertRoutes.js via express-validator.
 */

const { body, query, param } = require('express-validator');

// ── Shared ────────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['open', 'acknowledged', 'resolved', 'dismissed'];

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

const VALID_ALERT_TYPES = [
  'unusual_amount',
  'unusual_merchant',
  'unusual_location',
  'unusual_frequency',
  'card_not_present',
  'foreign_transaction',
  'large_transfer',
  'rapid_succession',
  'budget_breach',
  'other',
];

const VALID_RESOLVE_ACTIONS = [
  'confirmed_fraud',
  'false_positive',
  'user_verified',
  'auto_resolved',
];

// ── Rule sets ─────────────────────────────────────────────────────────────────

/**
 * Validate the :id route parameter as a MongoId.
 */
const idParamRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid alert ID'),
];

/**
 * Optional filters for GET /alerts.
 */
const listAlertRules = [
  query('status')
    .optional()
    .isIn(VALID_STATUSES)
    .withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),

  query('severity')
    .optional()
    .isIn(VALID_SEVERITIES)
    .withMessage(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`),

  query('alertType')
    .optional()
    .isIn(VALID_ALERT_TYPES)
    .withMessage(`alertType must be one of: ${VALID_ALERT_TYPES.join(', ')}`),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),

  query('sortBy')
    .optional()
    .isIn(['createdAt', 'severity', 'status'])
    .withMessage('sortBy must be one of: createdAt, severity, status'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be asc or desc'),
];

/**
 * Validate the resolve action and optional notes.
 */
const resolveAlertRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid alert ID'),

  body('action')
    .isIn(VALID_RESOLVE_ACTIONS)
    .withMessage(`action must be one of: ${VALID_RESOLVE_ACTIONS.join(', ')}`),

  body('notes')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 500 })
    .withMessage('notes cannot exceed 500 characters'),
];

/**
 * Optional lookbackHours for POST /scan.
 */
const scanRules = [
  body('lookbackHours')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('lookbackHours must be an integer between 1 and 168 (7 days)'),
];

module.exports = {
  idParamRules,
  listAlertRules,
  resolveAlertRules,
  scanRules,
};
