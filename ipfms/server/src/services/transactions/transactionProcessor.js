const mongoose = require('mongoose');
const Transaction = require('../../models/Transaction');
const Account = require('../../models/Account');
const { categorise } = require('./autoCategorizer');
const { checkDuplicate, buildFingerprint } = require('./duplicateDetector');
const { AppError } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');

/**
 * Transaction Processor — Algorithm 5.2
 *
 * Central pipeline for creating and updating transactions.
 * Every transaction write goes through this processor to ensure:
 *   1. Account ownership is verified
 *   2. Auto-categorisation is applied (if category not manually set)
 *   3. Duplicate detection runs before persistence
 *   4. Account balance is updated atomically
 *   5. Returned data is clean and consistent
 */

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a single transaction through the full processing pipeline.
 *
 * @param {string} userId
 * @param {object} data   Validated transaction fields from the request body
 * @returns {Promise<Transaction>}
 */
async function createTransaction(userId, data) {
  // 1 — Verify account ownership
  const account = await Account.findOne({
    _id: data.accountId,
    userId,
    isActive: true,
    deletedAt: null,
  });

  if (!account) {
    throw new AppError('Account not found or does not belong to you', 404, 'ACCOUNT_NOT_FOUND');
  }

  // 2 — Auto-categorise if no category supplied
  let category = data.category;
  let subcategory = data.subcategory || null;
  let categorySource = data.categorySource || 'auto';

  if (!category || category === 'Uncategorized') {
    const result = categorise({
      description: data.description,
      merchantName: data.merchant?.name,
      merchantCategory: data.merchant?.category,
      categoryCode: data.merchant?.categoryCode,
      amount: data.amount,
      type: data.type,
    });
    category = result.category;
    subcategory = result.subcategory;
    categorySource = 'auto';
  }

  // 3 — Duplicate detection
  const { isDuplicate, duplicateOf } = await checkDuplicate({
    accountId: data.accountId,
    amount: data.amount,
    date: new Date(data.date),
    description: data.description,
    externalId: data.externalId || null,
  });

  if (isDuplicate) {
    logger.warn(`[TransactionProcessor] Duplicate detected for account ${data.accountId}`);
  }

  // 4 — Build and save document
  const transaction = new Transaction({
    userId,
    accountId: data.accountId,
    externalId: data.externalId || null,
    idempotencyKey: data.idempotencyKey || null,
    amount: data.amount,
    currency: data.currency || account.currency || 'USD',
    originalAmount: data.originalAmount || null,
    originalCurrency: data.originalCurrency || null,
    type: data.type,
    date: new Date(data.date),
    postedAt: data.postedAt ? new Date(data.postedAt) : null,
    description: data.description,
    originalDescription: data.originalDescription || data.description,
    notes: data.notes || null,
    category,
    subcategory,
    categorySource,
    tags: data.tags || [],
    merchant: data.merchant || null,
    location: data.location || null,
    isPending: data.isPending || false,
    isRecurring: data.isRecurring || false,
    isDuplicate,
    duplicateOf: duplicateOf || null,
    scheduledPaymentId: data.scheduledPaymentId || null,
    descriptionFingerprint: buildFingerprint(data.description),
  });

  await transaction.save();

  // 5 — Update account balance (only for non-duplicate, non-pending)
  if (!isDuplicate && !transaction.isPending) {
    await updateAccountBalance(account, transaction.amount);
  }

  logger.info(`[TransactionProcessor] Created transaction ${transaction._id} for user ${userId}`);
  return transaction;
}

/**
 * Create multiple transactions in a single batch (e.g. bank sync import).
 * Processes each through the pipeline; returns results with success/failure per item.
 *
 * @param {string}  userId
 * @param {Array}   transactions  Array of validated transaction data objects
 * @returns {Promise<{ created: Transaction[], failed: Array<{data, error}> }>}
 */
async function createBatch(userId, transactions) {
  const created = [];
  const failed = [];

  for (const txData of transactions) {
    try {
      const tx = await createTransaction(userId, txData);
      created.push(tx);
    } catch (err) {
      failed.push({ data: txData, error: err.message });
    }
  }

  logger.info(`[TransactionProcessor] Batch import: ${created.length} created, ${failed.length} failed`);
  return { created, failed };
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update a transaction. Only certain fields are user-editable.
 * Re-runs auto-categorisation if description changes and category is 'auto'.
 *
 * @param {string}   userId
 * @param {string}   transactionId
 * @param {object}   updates
 * @returns {Promise<Transaction>}
 */
async function updateTransaction(userId, transactionId, updates) {
  const transaction = await Transaction.findOne({
    _id: transactionId,
    userId,
    deletedAt: null,
  });

  if (!transaction) {
    throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
  }

  const editableFields = ['description', 'notes', 'category', 'subcategory', 'tags', 'isRecurring', 'merchant', 'location'];

  editableFields.forEach((field) => {
    if (updates[field] !== undefined) {
      transaction[field] = updates[field];
    }
  });

  // If the user supplied a category, mark source as 'user'
  if (updates.category) {
    transaction.categorySource = 'user';
  } else if (updates.description && transaction.categorySource === 'auto') {
    // Re-run categorisation on description change if still on auto
    const result = categorise({
      description: transaction.description,
      merchantName: transaction.merchant?.name,
      amount: transaction.amount,
      type: transaction.type,
    });
    transaction.category = result.category;
    transaction.subcategory = result.subcategory;
  }

  await transaction.save();
  return transaction;
}

// ── Delete (soft) ─────────────────────────────────────────────────────────────

/**
 * Soft-delete a transaction and reverse its balance effect.
 * @param {string} userId
 * @param {string} transactionId
 * @returns {Promise<void>}
 */
async function deleteTransaction(userId, transactionId) {
  const transaction = await Transaction.findOne({
    _id: transactionId,
    userId,
    deletedAt: null,
  });

  if (!transaction) {
    throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
  }

  transaction.deletedAt = new Date();
  await transaction.save();

  // Reverse the balance impact
  if (!transaction.isDuplicate && !transaction.isPending) {
    const account = await Account.findById(transaction.accountId);
    if (account) {
      await updateAccountBalance(account, -transaction.amount); // reverse
    }
  }
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Build a paginated, filtered query for a user's transactions.
 *
 * @param {string} userId
 * @param {object} filters  Query params: accountId, category, type, startDate, endDate,
 *                          isFlagged, isRecurring, search, page, limit, sortBy, sortOrder
 * @returns {Promise<{ transactions: Transaction[], total: number, page: number, pages: number }>}
 */
async function queryTransactions(userId, filters = {}) {
  const {
    accountId,
    category,
    type,
    startDate,
    endDate,
    isFlagged,
    isRecurring,
    isDuplicate,
    search,
    page = 1,
    limit = 20,
    sortBy = 'date',
    sortOrder = 'desc',
  } = filters;

  const query = { userId, deletedAt: null };

  if (accountId) query.accountId = accountId;
  if (category) query.category = category;
  if (type) query.type = type;
  if (isFlagged !== undefined) query.isFlagged = isFlagged === 'true' || isFlagged === true;
  if (isRecurring !== undefined) query.isRecurring = isRecurring === 'true' || isRecurring === true;
  if (isDuplicate !== undefined) query.isDuplicate = isDuplicate === 'true' || isDuplicate === true;

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { 'merchant.name': { $regex: search, $options: 'i' } },
      { notes: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [transactions, total] = await Promise.all([
    Transaction.find(query).sort(sort).skip(skip).limit(Number(limit))
      .populate('accountId', 'name institutionName accountType'),
    Transaction.countDocuments(query),
  ]);

  return {
    transactions,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  };
}

/**
 * Get spending summary by category for a date range.
 * Used by the dashboard SpendingChart and BudgetProgressBars.
 *
 * @param {string} userId
 * @param {Date}   startDate
 * @param {Date}   endDate
 * @param {string} [accountId]
 * @returns {Promise<Array<{ category: string, total: number, count: number }>>}
 */
async function getSpendingByCategory(userId, startDate, endDate, accountId) {
  const matchStage = {
    userId: new mongoose.Types.ObjectId(userId),
    deletedAt: null,
    isDuplicate: false,
    type: { $in: ['debit', 'fee'] },
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
  };

  if (accountId) {
    matchStage.accountId = new mongoose.Types.ObjectId(accountId);
  }

  return Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
    { $project: { _id: 0, category: '$_id', total: 1, count: 1 } },
  ]);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Adjust an account's currentBalance by a delta.
 * Uses findByIdAndUpdate for atomicity.
 * @param {Account} account
 * @param {number}  delta   Positive = money out (increases debit balance), Negative = money in
 */
async function updateAccountBalance(account, delta) {
  // Convention: positive amount = debit = reduces balance
  await Account.findByIdAndUpdate(account._id, {
    $inc: { currentBalance: -delta },
    $push: {
      balanceHistory: {
        balance: account.currentBalance - delta,
        recordedAt: new Date(),
      },
    },
  });
}

module.exports = {
  createTransaction,
  createBatch,
  updateTransaction,
  deleteTransaction,
  queryTransactions,
  getSpendingByCategory,
};
