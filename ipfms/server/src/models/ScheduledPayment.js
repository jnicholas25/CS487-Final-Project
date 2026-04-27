const mongoose = require('mongoose');

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const ExecutionHistoryEntrySchema = new mongoose.Schema(
  {
    attemptedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['success', 'failed', 'skipped'],
      required: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    amount: { type: Number, default: null },
    errorCode: { type: String, default: null },
    errorMessage: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
  },
  { _id: true }
);

const RetryPolicySchema = new mongoose.Schema(
  {
    maxRetries: { type: Number, default: 3 },
    retryIntervalHours: { type: Number, default: 24 },
    currentRetries: { type: Number, default: 0 },
    nextRetryAt: { type: Date, default: null },
  },
  { _id: false }
);

// ── Main Schema ────────────────────────────────────────────────────────────────

const ScheduledPaymentSchema = new mongoose.Schema(
  {
    // ── Ownership ─────────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'accountId is required'],
    },

    // ── Payment details ───────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Payment name is required'],
      trim: true,
      maxlength: [100, 'Payment name cannot exceed 100 characters'],
    },
    description: { type: String, trim: true, default: null },
    category: { type: String, trim: true, default: 'Bills & Utilities' },

    payeeName: {
      type: String,
      required: [true, 'Payee name is required'],
      trim: true,
      maxlength: 100,
    },
    payeeAccountNumber: { type: String, trim: true, default: null, select: false },
    payeeRoutingNumber: { type: String, trim: true, default: null, select: false },
    payeeReference: { type: String, trim: true, default: null },

    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be positive'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      maxlength: 3,
    },
    isVariableAmount: { type: Boolean, default: false }, // e.g. utility bills

    // ── Schedule ──────────────────────────────────────────────────────────────
    frequency: {
      type: String,
      enum: [
        'once',
        'daily',
        'weekly',
        'biweekly',
        'monthly',
        'quarterly',
        'yearly',
      ],
      required: [true, 'Frequency is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: { type: Date, default: null }, // null = indefinite
    nextDueDate: {
      type: Date,
      required: [true, 'Next due date is required'],
      index: true,
    },
    dayOfMonth: { type: Number, min: 1, max: 31, default: null }, // for monthly
    dayOfWeek: { type: Number, min: 0, max: 6, default: null },   // 0=Sun for weekly

    // ── Balance check ─────────────────────────────────────────────────────────
    requireBalanceCheck: { type: Boolean, default: true },
    minimumBalanceRequired: { type: Number, default: 0 },
    skipIfInsufficientFunds: { type: Boolean, default: true },

    // ── Retry policy ──────────────────────────────────────────────────────────
    retryPolicy: { type: RetryPolicySchema, default: () => ({}) },

    // ── Notifications ─────────────────────────────────────────────────────────
    notifyBeforeDays: { type: Number, default: 3 },   // days before due date
    notifyOnExecution: { type: Boolean, default: true },
    notifyOnFailure: { type: Boolean, default: true },

    // ── Execution history ─────────────────────────────────────────────────────
    executionHistory: {
      type: [ExecutionHistoryEntrySchema],
      default: [],
    },
    lastExecutedAt: { type: Date, default: null },
    lastExecutionStatus: {
      type: String,
      // null means "never executed" — don't include null in enum, Mongoose
      // String enum validation won't recognise it; rely on default: null instead.
      enum: ['success', 'failed', 'skipped'],
      default: null,
    },
    totalExecutions: { type: Number, default: 0 },
    totalAmountPaid: { type: Number, default: 0 },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled', 'completed'],
      default: 'active',
      index: true,
    },
    pausedUntil: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },

    // ── Soft delete ───────────────────────────────────────────────────────────
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ───────────────────────────────────────────────────────────────────

ScheduledPaymentSchema.virtual('isOverdue').get(function () {
  return (
    this.status === 'active' &&
    this.nextDueDate &&
    this.nextDueDate < new Date()
  );
});

ScheduledPaymentSchema.virtual('daysUntilDue').get(function () {
  if (!this.nextDueDate) return null;
  const diff = this.nextDueDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// ── Indexes ────────────────────────────────────────────────────────────────────

ScheduledPaymentSchema.index({ userId: 1, status: 1 });
ScheduledPaymentSchema.index({ userId: 1, nextDueDate: 1 });
ScheduledPaymentSchema.index({ nextDueDate: 1, status: 1 }); // for cron queries
ScheduledPaymentSchema.index({ deletedAt: 1 });

// ── Model ──────────────────────────────────────────────────────────────────────

const ScheduledPayment = mongoose.model('ScheduledPayment', ScheduledPaymentSchema);

module.exports = ScheduledPayment;
