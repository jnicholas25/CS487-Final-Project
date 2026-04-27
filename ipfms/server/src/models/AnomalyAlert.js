const mongoose = require('mongoose');

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const DetectionMetaSchema = new mongoose.Schema(
  {
    // Statistical detection fields
    zScore: { type: Number, default: null },
    anomalyScore: { type: Number, default: null },   // 0–1 normalised score
    baseline: { type: Number, default: null },        // expected value used
    deviation: { type: Number, default: null },       // how far from baseline
    modelVersion: { type: String, default: null },    // ML model version that fired
    featureVector: { type: Map, of: Number, default: null }, // feature snapshot
    detectionRule: { type: String, default: null },   // named rule if rule-based
  },
  { _id: false }
);

const ResolutionSchema = new mongoose.Schema(
  {
    resolvedAt: { type: Date, required: true },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['confirmed_fraud', 'false_positive', 'user_verified', 'auto_resolved'],
      required: true,
    },
    notes: { type: String, default: null },
  },
  { _id: false }
);

// ── Main Schema ────────────────────────────────────────────────────────────────

const AnomalyAlertSchema = new mongoose.Schema(
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
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
      index: true,
    },

    // ── Alert classification ──────────────────────────────────────────────────
    alertType: {
      type: String,
      enum: [
        'unusual_amount',
        'unusual_merchant',
        'unusual_location',
        'unusual_frequency',
        'card_not_present',
        'foreign_transaction',
        'large_transfer',
        'rapid_succession',
        'budget_breach',
        'other',
      ],
      required: [true, 'Alert type is required'],
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },

    // ── Human-readable content ────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Alert title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Alert description is required'],
      trim: true,
      maxlength: 1000,
    },
    recommendation: { type: String, trim: true, default: null },

    // ── Detection data ────────────────────────────────────────────────────────
    detectionMeta: { type: DetectionMetaSchema, default: () => ({}) },

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['open', 'acknowledged', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolution: { type: ResolutionSchema, default: null },

    // ── Notification tracking ─────────────────────────────────────────────────
    notificationsSent: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },
    firstNotifiedAt: { type: Date, default: null },
    lastNotifiedAt: { type: Date, default: null },
    notificationCount: { type: Number, default: 0 },

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

AnomalyAlertSchema.virtual('isOpen').get(function () {
  return this.status === 'open';
});

AnomalyAlertSchema.virtual('isResolved').get(function () {
  return this.status === 'resolved' || this.status === 'dismissed';
});

AnomalyAlertSchema.virtual('ageHours').get(function () {
  return Math.round((Date.now() - this.createdAt) / (1000 * 60 * 60));
});

// ── Indexes ────────────────────────────────────────────────────────────────────

AnomalyAlertSchema.index({ userId: 1, status: 1 });
AnomalyAlertSchema.index({ userId: 1, severity: 1, status: 1 });
AnomalyAlertSchema.index({ userId: 1, createdAt: -1 });
AnomalyAlertSchema.index({ transactionId: 1 }, { sparse: true });
AnomalyAlertSchema.index({ deletedAt: 1 });

// ── Model ──────────────────────────────────────────────────────────────────────

const AnomalyAlert = mongoose.model('AnomalyAlert', AnomalyAlertSchema);

module.exports = AnomalyAlert;
