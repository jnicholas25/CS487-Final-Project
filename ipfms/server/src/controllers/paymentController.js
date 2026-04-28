const ScheduledPayment = require('../models/ScheduledPayment');
const Account          = require('../models/Account');
const { AppError }     = require('../middleware/errorHandler');
const {
  executePayment,
  processDuePayments,
  computeNextDueDate,
} = require('../services/payments/paymentScheduler');
const logger = require('../utils/logger');

/**
 * Payment Controller — HTTP layer for Step 5 (Scheduled Payments).
 *
 * Routes:
 *   GET    /api/v1/payments                  list & filter
 *   POST   /api/v1/payments                  create
 *   GET    /api/v1/payments/process          trigger batch due-payment run
 *   GET    /api/v1/payments/:id              get single
 *   PATCH  /api/v1/payments/:id              update
 *   DELETE /api/v1/payments/:id              cancel (soft delete)
 *   POST   /api/v1/payments/:id/execute      execute immediately
 *   PATCH  /api/v1/payments/:id/pause        pause
 *   PATCH  /api/v1/payments/:id/resume       resume
 */

// ── List ──────────────────────────────────────────────────────────────────────

exports.list = async (req, res, next) => {
  try {
    const {
      status, frequency,
      page = 1, limit = 20,
      sortBy = 'nextDueDate', sortOrder = 'asc',
    } = req.query;

    const query = { userId: req.user._id, deletedAt: null };
    if (status)    query.status    = status;
    if (frequency) query.frequency = frequency;

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [payments, total] = await Promise.all([
      ScheduledPayment.find(query).sort(sort).skip(skip).limit(Number(limit)),
      ScheduledPayment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Create ────────────────────────────────────────────────────────────────────

exports.create = async (req, res, next) => {
  try {
    const {
      accountId, name, description, category,
      payeeName, payeeReference,
      amount, currency, isVariableAmount,
      frequency, startDate, endDate, nextDueDate,
      dayOfMonth, dayOfWeek,
      requireBalanceCheck, minimumBalanceRequired, skipIfInsufficientFunds,
      notifyBeforeDays, notifyOnExecution, notifyOnFailure,
    } = req.body;

    // Verify account ownership
    const account = await Account.findOne({
      _id: accountId,
      userId: req.user._id,
      isActive: true,
      deletedAt: null,
    });
    if (!account) {
      return next(new AppError('Account not found or does not belong to you', 404, 'ACCOUNT_NOT_FOUND'));
    }

    const payment = await ScheduledPayment.create({
      userId: req.user._id,
      accountId,
      name,
      description: description || null,
      category: category || 'Bills & Utilities',
      payeeName,
      payeeReference: payeeReference || null,
      amount,
      currency: currency || account.currency || 'USD',
      isVariableAmount: isVariableAmount || false,
      frequency,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      nextDueDate: new Date(nextDueDate),
      dayOfMonth: dayOfMonth || null,
      dayOfWeek: dayOfWeek || null,
      requireBalanceCheck: requireBalanceCheck !== undefined ? requireBalanceCheck : true,
      minimumBalanceRequired: minimumBalanceRequired || 0,
      skipIfInsufficientFunds: skipIfInsufficientFunds !== undefined ? skipIfInsufficientFunds : true,
      notifyBeforeDays: notifyBeforeDays !== undefined ? notifyBeforeDays : 3,
      notifyOnExecution: notifyOnExecution !== undefined ? notifyOnExecution : true,
      notifyOnFailure: notifyOnFailure !== undefined ? notifyOnFailure : true,
    });

    const log = logger.withCorrelation(res.locals.correlationId);
    log.info(`[Payment] Created scheduled payment ${payment._id} for user ${req.user._id}`);

    res.status(201).json({
      success: true,
      message: 'Scheduled payment created',
      data: { payment },
    });
  } catch (err) {
    next(err);
  }
};

// ── Process due payments (batch run) ─────────────────────────────────────────

exports.processDue = async (req, res, next) => {
  try {
    const results = await processDuePayments(req.user._id.toString());

    res.status(200).json({
      success: true,
      message: `Processed due payments: ${results.succeeded} succeeded, ${results.failed} failed, ${results.skipped} skipped`,
      data: results,
    });
  } catch (err) {
    next(err);
  }
};

// ── Get single ────────────────────────────────────────────────────────────────

exports.getOne = async (req, res, next) => {
  try {
    const payment = await ScheduledPayment.findOne({
      _id: req.params.id,
      userId: req.user._id,
      deletedAt: null,
    });

    if (!payment) {
      return next(new AppError('Scheduled payment not found', 404, 'PAYMENT_NOT_FOUND'));
    }

    res.status(200).json({ success: true, data: { payment } });
  } catch (err) {
    next(err);
  }
};

// ── Update ────────────────────────────────────────────────────────────────────

exports.update = async (req, res, next) => {
  try {
    const payment = await ScheduledPayment.findOne({
      _id: req.params.id,
      userId: req.user._id,
      deletedAt: null,
    });

    if (!payment) {
      return next(new AppError('Scheduled payment not found', 404, 'PAYMENT_NOT_FOUND'));
    }

    const editable = [
      'name', 'description', 'category', 'payeeName', 'payeeReference',
      'amount', 'isVariableAmount', 'frequency',
      'endDate', 'nextDueDate', 'dayOfMonth', 'dayOfWeek',
      'notifyBeforeDays', 'notifyOnExecution', 'notifyOnFailure',
    ];

    for (const field of editable) {
      if (req.body[field] !== undefined) {
        if (['startDate', 'endDate', 'nextDueDate'].includes(field)) {
          payment[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          payment[field] = req.body[field];
        }
      }
    }

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Scheduled payment updated',
      data: { payment },
    });
  } catch (err) {
    next(err);
  }
};

// ── Cancel (soft delete) ──────────────────────────────────────────────────────

exports.remove = async (req, res, next) => {
  try {
    const payment = await ScheduledPayment.findOne({
      _id: req.params.id,
      userId: req.user._id,
      deletedAt: null,
    });

    if (!payment) {
      return next(new AppError('Scheduled payment not found', 404, 'PAYMENT_NOT_FOUND'));
    }

    payment.status = 'cancelled';
    payment.cancelledAt = new Date();
    payment.cancelReason = req.body.cancelReason || 'Cancelled by user';
    payment.deletedAt = new Date();
    await payment.save();

    res.status(200).json({ success: true, message: 'Scheduled payment cancelled' });
  } catch (err) {
    next(err);
  }
};

// ── Execute immediately ───────────────────────────────────────────────────────

exports.execute = async (req, res, next) => {
  try {
    const opts = {};
    if (req.body.overrideAmount) opts.overrideAmount = req.body.overrideAmount;

    const { payment, transaction, skipped } = await executePayment(
      req.params.id,
      req.user._id.toString(),
      opts
    );

    const log = logger.withCorrelation(res.locals.correlationId);
    log.info(`[Payment] Executed ${req.params.id} — skipped: ${skipped}`);

    res.status(200).json({
      success: true,
      message: skipped ? 'Payment skipped (insufficient funds)' : 'Payment executed successfully',
      data: { payment, transaction: transaction || null, skipped },
    });
  } catch (err) {
    if (err.code === 'PAYMENT_NOT_FOUND') {
      return next(new AppError(err.message, 404, 'PAYMENT_NOT_FOUND'));
    }
    if (err.code === 'PAYMENT_NOT_ACTIVE') {
      return next(new AppError(err.message, 409, 'PAYMENT_NOT_ACTIVE'));
    }
    next(err);
  }
};

// ── Pause ─────────────────────────────────────────────────────────────────────

exports.pause = async (req, res, next) => {
  try {
    const payment = await ScheduledPayment.findOne({
      _id: req.params.id,
      userId: req.user._id,
      deletedAt: null,
    });

    if (!payment) {
      return next(new AppError('Scheduled payment not found', 404, 'PAYMENT_NOT_FOUND'));
    }

    if (payment.status !== 'active') {
      return next(new AppError(
        `Only active payments can be paused (current status: "${payment.status}")`,
        409,
        'PAYMENT_NOT_ACTIVE'
      ));
    }

    payment.status = 'paused';
    payment.pausedUntil = req.body.pausedUntil ? new Date(req.body.pausedUntil) : null;
    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Scheduled payment paused',
      data: { payment },
    });
  } catch (err) {
    next(err);
  }
};

// ── Resume ────────────────────────────────────────────────────────────────────

exports.resume = async (req, res, next) => {
  try {
    const payment = await ScheduledPayment.findOne({
      _id: req.params.id,
      userId: req.user._id,
      deletedAt: null,
    });

    if (!payment) {
      return next(new AppError('Scheduled payment not found', 404, 'PAYMENT_NOT_FOUND'));
    }

    if (payment.status !== 'paused') {
      return next(new AppError(
        `Only paused payments can be resumed (current status: "${payment.status}")`,
        409,
        'PAYMENT_NOT_PAUSED'
      ));
    }

    payment.status = 'active';
    payment.pausedUntil = null;
    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Scheduled payment resumed',
      data: { payment },
    });
  } catch (err) {
    next(err);
  }
};
