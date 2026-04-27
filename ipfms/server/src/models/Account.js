const mongoose = require('mongoose');

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const BalanceHistoryEntrySchema = new mongoose.Schema(
  {
    balance: { type: Number, required: true },
    availableBalance: { type: Number, default: null },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const BankConnectionSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['plaid', 'yodlee', 'finicity', 'manual'],
      required: true,
    },
    externalAccountId: { type: String, required: true }, // provider's account ID
    accessToken: { type: String, select: false },         // encrypted token
    itemId: { type: String, default: null },              // e.g. Plaid item ID
    lastSyncedAt: { type: Date, default: null },
    syncStatus: {
      type: String,
      enum: ['active', 'error', 'disconnected', 'pending'],
      default: 'pending',
    },
    syncError: { type: String, default: null },
  },
  { _id: false }
);

// ── Main Schema ────────────────────────────────────────────────────────────────

const AccountSchema = new mongoose.Schema(
  {
    // ── Ownership ─────────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },

    // ── Identity & Display ────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
      maxlength: [100, 'Account name cannot exceed 100 characters'],
    },
    institutionName: { type: String, trim: true, default: null },
    institutionLogoUrl: { type: String, default: null },
    accountType: {
      type: String,
      enum: ['checking', 'savings', 'credit', 'investment', 'loan', 'other'],
      required: [true, 'Account type is required'],
    },
    accountSubtype: {
      type: String,
      trim: true,
      default: null, // e.g. 'money_market', '401k', 'cd'
    },

    // ── Masked identifiers ────────────────────────────────────────────────────
    mask: {
      type: String,
      trim: true,
      maxlength: 4,
      default: null, // last 4 digits of account number
    },
    officialName: { type: String, trim: true, default: null },

    // ── Balances ──────────────────────────────────────────────────────────────
    currentBalance: { type: Number, default: 0 },
    availableBalance: { type: Number, default: null },
    creditLimit: { type: Number, default: null },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      maxlength: 3,
    },

    // ── Balance history (rolling window) ──────────────────────────────────────
    balanceHistory: {
      type: [BalanceHistoryEntrySchema],
      default: [],
    },

    // ── Bank API connection ───────────────────────────────────────────────────
    bankConnection: { type: BankConnectionSchema, default: null },
    isManual: { type: Boolean, default: false },

    // ── Flags ─────────────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    isPrimary: { type: Boolean, default: false },
    excludeFromBudget: { type: Boolean, default: false },
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

AccountSchema.virtual('displayName').get(function () {
  const suffix = this.mask ? ` ••••${this.mask}` : '';
  return `${this.name}${suffix}`;
});

AccountSchema.virtual('isConnected').get(function () {
  return !!(
    this.bankConnection &&
    this.bankConnection.syncStatus === 'active'
  );
});

// ── Indexes ────────────────────────────────────────────────────────────────────

AccountSchema.index({ userId: 1, isActive: 1 });
AccountSchema.index({ userId: 1, accountType: 1 });
AccountSchema.index(
  { 'bankConnection.externalAccountId': 1 },
  { sparse: true }
);
AccountSchema.index({ deletedAt: 1 });

// ── Model ──────────────────────────────────────────────────────────────────────

const Account = mongoose.model('Account', AccountSchema);

module.exports = Account;
