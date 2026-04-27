const mongoose = require('mongoose');

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const BudgetCategorySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    limit: {
      type: Number,
      required: [true, 'Budget limit is required'],
      min: [0, 'Budget limit cannot be negative'],
    },
    spent: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Alert threshold as a percentage (e.g. 80 = alert when 80% of limit is used)
    alertThreshold: {
      type: Number,
      default: 80,
      min: 1,
      max: 100,
    },
    alertSent: { type: Boolean, default: false },
    color: { type: String, default: null }, // hex colour for UI rendering
    icon: { type: String, default: null },  // icon identifier string
    notes: { type: String, default: null },
  },
  { _id: true }
);

BudgetCategorySchema.virtual('remaining').get(function () {
  return Math.max(0, this.limit - this.spent);
});

BudgetCategorySchema.virtual('percentUsed').get(function () {
  if (this.limit === 0) return 100;
  return Math.min(100, Math.round((this.spent / this.limit) * 100));
});

BudgetCategorySchema.virtual('isOverBudget').get(function () {
  return this.spent > this.limit;
});

// ── Main Schema ────────────────────────────────────────────────────────────────

const BudgetSchema = new mongoose.Schema(
  {
    // ── Ownership ─────────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },

    // ── Period ────────────────────────────────────────────────────────────────
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null, // e.g. "March 2025 Budget"
    },
    period: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'],
      default: 'monthly',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },

    // ── Totals (auto-computed in pre-save) ────────────────────────────────────
    totalLimit: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },

    // ── Categories ────────────────────────────────────────────────────────────
    categories: {
      type: [BudgetCategorySchema],
      default: [],
    },

    // ── Rollover settings ─────────────────────────────────────────────────────
    rolloverEnabled: { type: Boolean, default: false },
    rolloverAmount: { type: Number, default: 0 }, // amount carried from previous period

    // ── Savings goal ──────────────────────────────────────────────────────────
    savingsGoal: { type: Number, default: null },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    isTemplate: { type: Boolean, default: false }, // reusable budget template

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

BudgetSchema.virtual('totalRemaining').get(function () {
  return Math.max(0, this.totalLimit - this.totalSpent);
});

BudgetSchema.virtual('percentUsed').get(function () {
  if (this.totalLimit === 0) return 100;
  return Math.min(100, Math.round((this.totalSpent / this.totalLimit) * 100));
});

BudgetSchema.virtual('isOverBudget').get(function () {
  return this.totalSpent > this.totalLimit;
});

BudgetSchema.virtual('daysRemaining').get(function () {
  const now = new Date();
  if (now > this.endDate) return 0;
  return Math.ceil((this.endDate - now) / (1000 * 60 * 60 * 24));
});

// ── Pre-save hook – recompute totals from categories ──────────────────────────

BudgetSchema.pre('save', function (next) {
  if (this.isModified('categories')) {
    this.totalLimit = this.categories.reduce((sum, c) => sum + c.limit, 0);
    this.totalSpent = this.categories.reduce((sum, c) => sum + c.spent, 0);
  }
  next();
});

// ── Indexes ────────────────────────────────────────────────────────────────────

BudgetSchema.index({ userId: 1, isActive: 1 });
BudgetSchema.index({ userId: 1, startDate: -1 });
BudgetSchema.index({ deletedAt: 1 });

// ── Model ──────────────────────────────────────────────────────────────────────

const Budget = mongoose.model('Budget', BudgetSchema);

module.exports = Budget;
