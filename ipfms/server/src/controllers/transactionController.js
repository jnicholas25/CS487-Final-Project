const {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  queryTransactions,
  getSpendingByCategory,
} = require('../services/transactions/transactionProcessor');
const { AppError } = require('../middleware/errorHandler');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');

/**
 * Transaction Controller — HTTP layer for Step 3 (Transaction Tracking).
 *
 * Routes:
 *   GET    /api/v1/transactions            list & filter
 *   POST   /api/v1/transactions            create (manual entry)
 *   GET    /api/v1/transactions/summary    spending by category
 *   GET    /api/v1/transactions/:id        get single
 *   PATCH  /api/v1/transactions/:id        update
 *   DELETE /api/v1/transactions/:id        soft delete
 *   PATCH  /api/v1/transactions/:id/flag   toggle fraud flag
 */

// ── List & filter ─────────────────────────────────────────────────────────────

exports.list = async (req, res, next) => {
  try {
    const result = await queryTransactions(req.user._id.toString(), req.query);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// ── Spending summary ──────────────────────────────────────────────────────────

exports.summary = async (req, res, next) => {
  try {
    const { startDate, endDate, accountId } = req.query;
    const data = await getSpendingByCategory(
      req.user._id.toString(),
      startDate,
      endDate,
      accountId || null
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ── Get single ────────────────────────────────────────────────────────────────

exports.getOne = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user._id,
      deletedAt: null,
    });

    if (!transaction) {
      return next(new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND'));
    }

    res.status(200).json({ success: true, data: { transaction } });
  } catch (err) {
    next(err);
  }
};

// ── Create (manual entry) ─────────────────────────────────────────────────────

exports.create = async (req, res, next) => {
  try {
    const transaction = await createTransaction(req.user._id.toString(), req.body);

    const log = logger.withCorrelation(res.locals.correlationId);
    log.info(`[Transaction] Created ${transaction._id} (${transaction.category})`);

    res.status(201).json({
      success: true,
      message: 'Transaction created',
      data: { transaction },
    });
  } catch (err) {
    next(err);
  }
};

// ── Update ────────────────────────────────────────────────────────────────────

exports.update = async (req, res, next) => {
  try {
    const transaction = await updateTransaction(
      req.user._id.toString(),
      req.params.id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: 'Transaction updated',
      data: { transaction },
    });
  } catch (err) {
    next(err);
  }
};

// ── Delete (soft) ─────────────────────────────────────────────────────────────

exports.remove = async (req, res, next) => {
  try {
    await deleteTransaction(req.user._id.toString(), req.params.id);
    res.status(200).json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    next(err);
  }
};

// ── Toggle fraud flag ─────────────────────────────────────────────────────────

exports.toggleFlag = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user._id,
      deletedAt: null,
    });

    if (!transaction) {
      return next(new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND'));
    }

    transaction.isFlagged = !transaction.isFlagged;

    if (transaction.isFlagged) {
      transaction.fraudMeta = {
        ...transaction.fraudMeta,
        flaggedAt: new Date(),
        flaggedBy: 'user',
      };
    } else {
      // Unflagging = resolving
      if (transaction.fraudMeta) {
        transaction.fraudMeta.resolvedAt = new Date();
        transaction.fraudMeta.resolutionNote = req.body.resolutionNote || 'Marked as legitimate by user';
      }
    }

    await transaction.save();

    res.status(200).json({
      success: true,
      message: `Transaction ${transaction.isFlagged ? 'flagged' : 'unflagged'} successfully`,
      data: { transaction },
    });
  } catch (err) {
    next(err);
  }
};
