const mongoose = require('mongoose');

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const MerchantSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: null },
    category: { type: String, trim: true, default: null },     // MCC category string
    categoryCode: { type: String, trim: true, default: null }, // MCC numeric code
    logoUrl: { type: String, default: null },
    website: { type: String, default: null },
  },
  { _id: false }
);

const LocationSchema = new mongoose.Schema(
  {
    address: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    postalCode: { type: String, default: null },
    country: { type: String, default: null },
    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
  },
  { _id: false }
);

const FraudMetaSchema = new mongoose.Schema(
  {
    zScore: { type: Number, default: null },
    anomalyScore: { type: Number, default: null },
    flaggedAt: { type: Date, default: null },
    flaggedBy: {
      type: String,
      enum: ['system', 'user', 'support'],
      default: null,
    },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null },
  },
  { _id: false }
);

// ── Main Schema ────────────────────────────────────────────────────────────────

const TransactionSchema = new mongoose.Schema(
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
      index: true,
    },

    // ── External IDs ──────────────────────────────────────────────────────────
    // Provider's transaction ID — used for deduplication
    externalId: { type: String, trim: true, default: null },
    // Client-supplied idempotency key for manual entries
    idempotencyKey: { type: String, trim: true, default: null },

    // ── Core financials ───────────────────────────────────────────────────────
    // Convention: positive = debit (money out), negative = credit (money in)
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      maxlength: 3,
    },
    originalAmount: { type: Number, default: null },   // before FX conversion
    originalCurrency: { type: String, default: null },

    type: {
      type: String,
      enum: ['debit', 'credit', 'transfer', 'refund', 'fee'],
      required: [true, 'Transaction type is required'],
    },

    // ── Dates ─────────────────────────────────────────────────────────────────
    date: {
      type: Date,
      required: [true, 'Transaction date is required'],
      index: true,
    },
    postedAt: { type: Date, default: null },       // settlement / posting date
    pendingUntil: { type: Date, default: null },

    // ── Description & Categorisation ─────────────────────────────────────────
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    originalDescription: { type: String, trim: true, default: null }, // raw from bank
    notes: { type: String, trim: true, maxlength: 1000, default: null },

    category: {
      type: String,
      trim: true,
      default: 'Uncategorized',
    },
    subcategory: { type: String, trim: true, default: null },
    categorySource: {
      type: String,
      enum: ['auto', 'user', 'rule'],
      default: 'auto',
    },
    tags: { type: [String], default: [] },

    // ── Merchant & Location ───────────────────────────────────────────────────
    merchant: { type: MerchantSchema, default: null },
    location: { type: LocationSchema, default: null },

    // ── Status Flags ──────────────────────────────────────────────────────────
    isPending: { type: Boolean, default: false },
    isRecurring: { type: Boolean, default: false },
    isDuplicate: { type: Boolean, default: false },
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },

    // ── Fraud / Anomaly ───────────────────────────────────────────────────────
    isFlagged: { type: Boolean, default: false },
    fraudMeta: { type: FraudMetaSchema, default: null },

    // ── Linked entities ───────────────────────────────────────────────────────
    scheduledPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduledPayment',
      default: null,
    },
    anomalyAlertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnomalyAlert',
      default: null,
    },

    // ── Deduplication fingerprint ─────────────────────────────────────────────
    // Normalised description used for Strategy-B duplicate matching.
    // Set by transactionProcessor on creation; indexed for fast lookup.
    descriptionFingerprint: { type: String, trim: true, default: null },

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

TransactionSchema.virtual('isCredit').get(function () {
  return this.amount < 0;
});

TransactionSchema.virtual('absoluteAmount').get(function () {
  return Math.abs(this.amount);
});

// ── Indexes ────────────────────────────────────────────────────────────────────

TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, category: 1, date: -1 });
TransactionSchema.index({ accountId: 1, date: -1 });
TransactionSchema.index(
  { externalId: 1, accountId: 1 },
  { unique: true, sparse: true }
);
TransactionSchema.index({ isFlagged: 1, userId: 1 });
TransactionSchema.index({ isRecurring: 1, userId: 1 });
TransactionSchema.index({ accountId: 1, amount: 1, date: -1, descriptionFingerprint: 1 });
TransactionSchema.index({ deletedAt: 1 });

// ── Model ──────────────────────────────────────────────────────────────────────

const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;
