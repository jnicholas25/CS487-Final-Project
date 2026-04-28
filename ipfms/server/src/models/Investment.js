/**
 * Investment Model — Step 7 (Investment Tracker & Financial Reports)
 *
 * Represents a single investment holding (stock, ETF, crypto, bond, etc.).
 * Dividend records are embedded as a sub-document array since they belong
 * exclusively to a holding and are always queried alongside it.
 *
 * Virtuals (not persisted, available via toJSON / toObject):
 *   currentValue     — quantity × currentPrice  (null if no price set)
 *   totalCostBasis   — quantity × averageCostBasis
 *   gainLoss         — currentValue − totalCostBasis
 *   gainLossPct      — gainLoss / totalCostBasis × 100
 *   totalDividends   — sum of all dividend amounts
 */

const mongoose = require('mongoose');

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const DividendSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, 'Dividend amount is required'],
      min: [0, 'Dividend amount must be non-negative'],
    },
    date: {
      type: Date,
      required: [true, 'Dividend date is required'],
    },
    type: {
      type: String,
      enum: ['cash', 'stock', 'drip'],
      default: 'cash',
    },
    notes: { type: String, trim: true, default: null },
  },
  { _id: true, timestamps: false }
);

// ── Main Schema ────────────────────────────────────────────────────────────────

const InvestmentSchema = new mongoose.Schema(
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
      default: null,
    },

    // ── Security identity ─────────────────────────────────────────────────────
    symbol: {
      type: String,
      required: [true, 'Symbol is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Symbol cannot exceed 20 characters'],
    },
    name: {
      type: String,
      required: [true, 'Investment name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    assetType: {
      type: String,
      enum: ['stock', 'etf', 'mutual_fund', 'crypto', 'bond', 'other'],
      default: 'stock',
    },
    exchange: { type: String, trim: true, default: null }, // e.g. 'NASDAQ', 'NYSE'

    // ── Position ──────────────────────────────────────────────────────────────
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity must be non-negative'],
    },
    // Cost per unit (weighted average across all purchases)
    averageCostBasis: {
      type: Number,
      required: [true, 'Average cost basis is required'],
      min: [0, 'Cost basis must be non-negative'],
    },

    // ── Current price (manually updated or from a feed) ───────────────────────
    currentPrice: {
      type: Number,
      default: null,
      min: [0, 'Price must be non-negative'],
    },
    priceUpdatedAt: { type: Date, default: null },

    // ── Currency ──────────────────────────────────────────────────────────────
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      maxlength: 3,
    },

    // ── Metadata ──────────────────────────────────────────────────────────────
    purchaseDate: { type: Date, default: null },
    notes:        { type: String, trim: true, maxlength: 1000, default: null },
    tags:         { type: [String], default: [] },

    // ── Dividend history ──────────────────────────────────────────────────────
    dividends: { type: [DividendSchema], default: [] },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive:  { type: Boolean, default: true },
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

InvestmentSchema.virtual('currentValue').get(function () {
  return this.currentPrice != null ? this.quantity * this.currentPrice : null;
});

InvestmentSchema.virtual('totalCostBasis').get(function () {
  return this.quantity * this.averageCostBasis;
});

InvestmentSchema.virtual('gainLoss').get(function () {
  if (this.currentPrice == null) return null;
  return this.currentValue - this.totalCostBasis;
});

InvestmentSchema.virtual('gainLossPct').get(function () {
  const basis = this.totalCostBasis;
  if (this.currentPrice == null || basis === 0) return null;
  return (this.gainLoss / basis) * 100;
});

InvestmentSchema.virtual('totalDividends').get(function () {
  return this.dividends.reduce((sum, d) => sum + d.amount, 0);
});

// ── Indexes ────────────────────────────────────────────────────────────────────

InvestmentSchema.index({ userId: 1, symbol: 1 });
InvestmentSchema.index({ userId: 1, assetType: 1 });
InvestmentSchema.index({ userId: 1, isActive: 1 });
InvestmentSchema.index({ deletedAt: 1 });

// ── Model ──────────────────────────────────────────────────────────────────────

const Investment = mongoose.model('Investment', InvestmentSchema);

module.exports = Investment;
