const mongoose = require('mongoose');

// ── Main Schema ────────────────────────────────────────────────────────────────

const AuditLogSchema = new mongoose.Schema(
  {
    // ── Actor ─────────────────────────────────────────────────────────────────
    // Who performed the action (null for system-initiated actions)
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      enum: ['user', 'admin', 'support', 'system', 'cron'],
      default: 'system',
    },

    // ── Action ────────────────────────────────────────────────────────────────
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      // e.g. 'user.login', 'transaction.create', 'budget.update', 'payment.execute'
    },
    category: {
      type: String,
      enum: [
        'auth',
        'user',
        'account',
        'transaction',
        'budget',
        'payment',
        'investment',
        'alert',
        'report',
        'settings',
        'system',
        'admin',
      ],
      required: [true, 'Category is required'],
      index: true,
    },

    // ── Target resource ───────────────────────────────────────────────────────
    resourceType: {
      type: String,
      trim: true,
      default: null, // e.g. 'Transaction', 'Budget', 'ScheduledPayment'
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    // ── Outcome ───────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['success', 'failure', 'partial'],
      default: 'success',
    },
    statusCode: { type: Number, default: null }, // HTTP status code if applicable

    // ── Change data ───────────────────────────────────────────────────────────
    before: { type: mongoose.Schema.Types.Mixed, default: null }, // snapshot before
    after: { type: mongoose.Schema.Types.Mixed, default: null },  // snapshot after
    diff: { type: mongoose.Schema.Types.Mixed, default: null },   // computed diff

    // ── Request context ───────────────────────────────────────────────────────
    ipAddress: { type: String, trim: true, default: null },
    userAgent: { type: String, trim: true, default: null },
    correlationId: { type: String, trim: true, default: null }, // request trace ID
    sessionId: { type: String, trim: true, default: null },

    // ── Error details (on failure) ────────────────────────────────────────────
    errorCode: { type: String, default: null },
    errorMessage: { type: String, default: null },

    // ── Extra metadata ────────────────────────────────────────────────────────
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: null },

    // ── Timestamp (immutable — no updatedAt) ──────────────────────────────────
    // index: intentionally omitted here — a TTL index on timestamp is declared
    // below, and MongoDB cannot have two indexes with the same key pattern.
    // Compound indexes (actorId+timestamp, etc.) also serve range queries.
    timestamp: { type: Date, default: Date.now },
  },
  {
    // AuditLogs are intentionally immutable — no updatedAt
    timestamps: { createdAt: 'timestamp', updatedAt: false },
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

// ── Indexes ────────────────────────────────────────────────────────────────────

AuditLogSchema.index({ actorId: 1, timestamp: -1 });
AuditLogSchema.index({ category: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
AuditLogSchema.index({ correlationId: 1 }, { sparse: true });
AuditLogSchema.index({ status: 1, timestamp: -1 });
// TTL index: auto-purge logs older than 2 years (63072000 seconds)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

// ── Guard against accidental updates ──────────────────────────────────────────

AuditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'update'], function (next) {
  const err = new Error('AuditLog documents are immutable and cannot be updated.');
  next(err);
});

// ── Static helpers ─────────────────────────────────────────────────────────────

/**
 * Convenience factory — create and persist a log entry in one call.
 * @param {Object} data  Fields to log
 * @returns {Promise<AuditLog>}
 */
AuditLogSchema.statics.record = async function (data) {
  return this.create(data);
};

// ── Model ──────────────────────────────────────────────────────────────────────

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

module.exports = AuditLog;
