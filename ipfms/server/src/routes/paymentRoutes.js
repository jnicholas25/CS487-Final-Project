const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../validators/authValidator');
const {
  createPaymentRules,
  updatePaymentRules,
  listPaymentRules,
  pausePaymentRules,
  executePaymentRules,
  idParamRules,
} = require('../validators/paymentValidator');

// All payment routes require authentication
router.use(protect);

/**
 * GET /api/v1/payments
 * List the user's scheduled payments.
 * Query params: status, frequency, page, limit, sortBy, sortOrder
 */
router.get('/', listPaymentRules, validate, paymentController.list);

/**
 * POST /api/v1/payments
 * Create a new scheduled payment.
 */
router.post('/', createPaymentRules, validate, paymentController.create);

/**
 * GET /api/v1/payments/process
 * Trigger a batch run of all due payments for the authenticated user.
 * In production this is called by a cron job; the endpoint enables on-demand testing.
 */
router.get('/process', paymentController.processDue);

/**
 * GET /api/v1/payments/:id
 * Retrieve a single scheduled payment by ID.
 */
router.get('/:id', idParamRules, validate, paymentController.getOne);

/**
 * PATCH /api/v1/payments/:id
 * Update editable fields on a scheduled payment.
 */
router.patch('/:id', updatePaymentRules, validate, paymentController.update);

/**
 * DELETE /api/v1/payments/:id
 * Cancel and soft-delete a scheduled payment.
 */
router.delete('/:id', idParamRules, validate, paymentController.remove);

/**
 * POST /api/v1/payments/:id/execute
 * Execute a scheduled payment immediately (bypasses the normal due-date check).
 */
router.post('/:id/execute', executePaymentRules, validate, paymentController.execute);

/**
 * PATCH /api/v1/payments/:id/pause
 * Pause a scheduled payment.  Optional body: { pausedUntil: ISO8601 }
 */
router.patch('/:id/pause', pausePaymentRules, validate, paymentController.pause);

/**
 * PATCH /api/v1/payments/:id/resume
 * Resume a paused scheduled payment.
 */
router.patch('/:id/resume', idParamRules, validate, paymentController.resume);

module.exports = router;
