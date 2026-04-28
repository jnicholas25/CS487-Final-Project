/**
 * Payment Scheduler — Step 6 / Algorithm 5.4 (Autopayment Manager)
 *
 * Manages the full lifecycle of a scheduled payment:
 *
 *   1. computeNextDueDate   — pure function that advances a date by one period
 *   2. checkSufficientFunds — validates account balance before execution
 *   3. executePayment       — runs one occurrence: balance check → create transaction
 *                             → update payment record → compute next due date
 *   4. processDuePayments   — batch runner: finds all overdue active payments and
 *                             executes them (called by cron or on-demand endpoint)
 *
 * The service is decoupled from HTTP; the controller owns request/response.
 */

const mongoose = require('mongoose');
const ScheduledPayment = require('../../models/ScheduledPayment');
const Account          = require('../../models/Account');
const { createTransaction } = require('../transactions/transactionProcessor');
const { AppError }          = require('../../middleware/errorHandler');
const logger                = require('../../utils/logger');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Advance a date by one recurrence period.
 *
 * @param {Date}   currentDate  The date to advance from.
 * @param {string} frequency    'once'|'daily'|'weekly'|'biweekly'|'monthly'|'quarterly'|'yearly'
 * @param {number} [dayOfMonth] Preferred day-of-month for monthly+ frequencies (1–31).
 * @param {number} [dayOfWeek]  Preferred day-of-week for weekly/biweekly (0=Sun … 6=Sat).
 * @returns {Date|null}  Next due date, or null for one-off payments.
 */
function computeNextDueDate(currentDate, frequency, dayOfMonth = null, dayOfWeek = null) {
  const d = new Date(currentDate);

  switch (frequency) {
    case 'once':
      return null;

    case 'daily':
      d.setDate(d.getDate() + 1);
      return d;

    case 'weekly': {
      d.setDate(d.getDate() + 7);
      if (dayOfWeek !== null) {
        _adjustToDayOfWeek(d, dayOfWeek);
      }
      return d;
    }

    case 'biweekly':
      d.setDate(d.getDate() + 14);
      return d;

    case 'monthly': {
      d.setMonth(d.getMonth() + 1);
      if (dayOfMonth !== null) {
        _adjustToDayOfMonth(d, dayOfMonth);
      }
      return d;
    }

    case 'quarterly': {
      d.setMonth(d.getMonth() + 3);
      if (dayOfMonth !== null) {
        _adjustToDayOfMonth(d, dayOfMonth);
      }
      return d;
    }

    case 'yearly': {
      d.setFullYear(d.getFullYear() + 1);
      return d;
    }

    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

/**
 * Verify an account has sufficient funds to cover a payment.
 *
 * @param {string} accountId
 * @param {number} amount
 * @returns {Promise<{ sufficient: boolean, currentBalance: number }>}
 */
async function checkSufficientFunds(accountId, amount) {
  const account = await Account.findOne({
    _id: accountId,
    isActive: true,
    deletedAt: null,
  });

  if (!account) {
    throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
  }

  return {
    sufficient: account.currentBalance >= amount,
    currentBalance: account.currentBalance,
  };
}

/**
 * Execute a single scheduled payment occurrence.
 *
 * Pipeline:
 *   1. Load & validate the payment record
 *   2. Balance check (if enabled)
 *   3. Create a debit transaction via the existing transactionProcessor
 *   4. Record execution in executionHistory
 *   5. Advance nextDueDate; mark completed if endDate passed or one-off
 *   6. Persist and return the updated record
 *
 * @param {string}  paymentId
 * @param {string}  userId
 * @param {object}  [opts]
 * @param {number}  [opts.overrideAmount]  Use a custom amount (for variable-amount payments).
 * @returns {Promise<{ payment: ScheduledPayment, transaction: Transaction|null, skipped: boolean }>}
 */
async function executePayment(paymentId, userId, opts = {}) {
  const payment = await ScheduledPayment.findOne({
    _id: paymentId,
    userId,
    deletedAt: null,
  });

  if (!payment) {
    throw new AppError('Scheduled payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  if (payment.status !== 'active') {
    throw new AppError(
      `Cannot execute a payment with status "${payment.status}"`,
      409,
      'PAYMENT_NOT_ACTIVE'
    );
  }

  const amount = opts.overrideAmount || payment.amount;

  // ── Balance check ─────────────────────────────────────────────────────────
  if (payment.requireBalanceCheck) {
    const { sufficient, currentBalance } = await checkSufficientFunds(
      payment.accountId.toString(),
      amount
    );

    if (!sufficient) {
      if (payment.skipIfInsufficientFunds) {
        // Record a skipped execution and reschedule
        await _recordExecution(payment, 'skipped', null, amount, null, 'INSUFFICIENT_FUNDS', `Balance $${currentBalance.toFixed(2)} < required $${amount.toFixed(2)}`);
        return { payment, transaction: null, skipped: true };
      }
      throw new AppError(
        `Insufficient funds: balance $${currentBalance.toFixed(2)}, required $${amount.toFixed(2)}`,
        422,
        'INSUFFICIENT_FUNDS'
      );
    }
  }

  // ── Create transaction ────────────────────────────────────────────────────
  let transaction = null;
  try {
    transaction = await createTransaction(userId, {
      accountId: payment.accountId.toString(),
      amount,
      type: 'debit',
      date: new Date(),
      description: payment.name,
      category: payment.category || 'Bills & Utilities',
      categorySource: 'auto',
      notes: `Scheduled payment — ${payment.payeeName}`,
      isRecurring: payment.frequency !== 'once',
      scheduledPaymentId: payment._id,
    });

    await _recordExecution(payment, 'success', transaction._id, amount, null, null, null);
    logger.info(`[PaymentScheduler] Executed payment ${paymentId} → tx ${transaction._id}`);
  } catch (err) {
    // Record failure but don't throw — let the caller decide
    await _recordExecution(payment, 'failed', null, amount, null, 'EXECUTION_ERROR', err.message);
    logger.error(`[PaymentScheduler] Execution failed for ${paymentId}: ${err.message}`);
    throw err;
  }

  return { payment, transaction, skipped: false };
}

/**
 * Find every active scheduled payment that is due now or overdue, and execute
 * each one in sequence.  Failures on individual payments are isolated so one
 * bad payment doesn't block the rest.
 *
 * @param {string} userId
 * @returns {Promise<{ succeeded: number, failed: number, skipped: number, results: object[] }>}
 */
async function processDuePayments(userId) {
  const now = new Date();
  const duePayments = await ScheduledPayment.find({
    userId,
    status: 'active',
    nextDueDate: { $lte: now },
    deletedAt: null,
  });

  const results = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const payment of duePayments) {
    try {
      const result = await executePayment(payment._id.toString(), userId);
      results.push({ paymentId: payment._id, status: result.skipped ? 'skipped' : 'success' });
      if (result.skipped) skipped++;
      else succeeded++;
    } catch (err) {
      results.push({ paymentId: payment._id, status: 'failed', error: err.message });
      failed++;
    }
  }

  logger.info(`[PaymentScheduler] Processed ${duePayments.length} due payments — ${succeeded} ok, ${failed} failed, ${skipped} skipped`);
  return { succeeded, failed, skipped, results };
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Append an entry to executionHistory, update totals, and advance nextDueDate.
 * Mutates the payment document and saves it.
 *
 * @param {ScheduledPayment} payment
 * @param {'success'|'failed'|'skipped'} status
 * @param {ObjectId|null} transactionId
 * @param {number} amount
 * @param {Date|null} attemptedAt
 * @param {string|null} errorCode
 * @param {string|null} errorMessage
 */
async function _recordExecution(payment, status, transactionId, amount, attemptedAt, errorCode, errorMessage) {
  const now = attemptedAt || new Date();

  payment.executionHistory.push({
    attemptedAt: now,
    status,
    transactionId: transactionId || null,
    amount,
    errorCode: errorCode || null,
    errorMessage: errorMessage || null,
    retryCount: payment.retryPolicy?.currentRetries || 0,
  });

  payment.lastExecutedAt = now;
  payment.lastExecutionStatus = status;

  if (status === 'success') {
    payment.totalExecutions += 1;
    payment.totalAmountPaid += amount;
    payment.retryPolicy.currentRetries = 0;
    payment.retryPolicy.nextRetryAt = null;
  } else if (status === 'failed') {
    payment.retryPolicy.currentRetries = (payment.retryPolicy.currentRetries || 0) + 1;
    if (payment.retryPolicy.currentRetries <= (payment.retryPolicy.maxRetries || 3)) {
      const nextRetry = new Date(now);
      nextRetry.setHours(nextRetry.getHours() + (payment.retryPolicy.retryIntervalHours || 24));
      payment.retryPolicy.nextRetryAt = nextRetry;
    }
  }

  // Advance nextDueDate (for success or skipped — not for failed/pending retry)
  if (status === 'success' || status === 'skipped') {
    const nextDue = computeNextDueDate(
      now,
      payment.frequency,
      payment.dayOfMonth,
      payment.dayOfWeek
    );

    if (!nextDue) {
      // One-off payment — mark as completed
      payment.status = 'completed';
      payment.nextDueDate = null;
    } else if (payment.endDate && nextDue > payment.endDate) {
      // Past end date — mark as completed
      payment.status = 'completed';
      payment.nextDueDate = null;
    } else {
      payment.nextDueDate = nextDue;
    }
  }

  await payment.save();
}

/**
 * Clamp a date's day-of-month to the last valid day in that month.
 * e.g. requesting day 31 in February → Feb 28/29.
 */
function _adjustToDayOfMonth(d, day) {
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInMonth));
}

/**
 * Advance a date to the next occurrence of `targetDow` (0=Sun … 6=Sat).
 * If the date is already on that day, it stays.
 */
function _adjustToDayOfWeek(d, targetDow) {
  const diff = (targetDow - d.getDay() + 7) % 7;
  if (diff > 0) d.setDate(d.getDate() + diff);
}

module.exports = {
  computeNextDueDate,
  checkSufficientFunds,
  executePayment,
  processDuePayments,
};
