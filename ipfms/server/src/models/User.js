const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const TwoFactorSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    secret: { type: String, select: false },          // TOTP secret (encrypted at rest)
    backupCodes: { type: [String], select: false },   // hashed one-time backup codes
    verifiedAt: { type: Date },
  },
  { _id: false }
);

const NotificationPreferencesSchema = new mongoose.Schema(
  {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    fraudAlerts: { type: Boolean, default: true },
    budgetAlerts: { type: Boolean, default: true },
    paymentReminders: { type: Boolean, default: true },
    weeklyReport: { type: Boolean, default: false },
  },
  { _id: false }
);

const LockoutSchema = new mongoose.Schema(
  {
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastFailedAt: { type: Date, default: null },
  },
  { _id: false }
);

// ── Main Schema ────────────────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{6,14}$/, 'Please provide a valid phone number'],
      default: null,
    },
    avatarUrl: { type: String, default: null },

    // ── Authentication ────────────────────────────────────────────────────────
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'support'],
      default: 'user',
    },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false, default: null },
    emailVerificationExpires: { type: Date, select: false, default: null },
    passwordResetToken: { type: String, select: false, default: null },
    passwordResetExpires: { type: Date, select: false, default: null },

    // ── Two-Factor Auth ───────────────────────────────────────────────────────
    twoFactor: { type: TwoFactorSchema, default: () => ({}) },

    // ── Session / Lockout ─────────────────────────────────────────────────────
    lockout: { type: LockoutSchema, default: () => ({}) },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },

    // ── Preferences ───────────────────────────────────────────────────────────
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD', uppercase: true, maxlength: 3 },
    notificationPreferences: {
      type: NotificationPreferencesSchema,
      default: () => ({}),
    },

    // ── Soft delete ───────────────────────────────────────────────────────────
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,       // adds createdAt, updatedAt
    toJSON: {
      virtuals: true,
      transform(_, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ───────────────────────────────────────────────────────────────────

UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

UserSchema.virtual('isLocked').get(function () {
  return !!(this.lockout.lockedUntil && this.lockout.lockedUntil > new Date());
});

// ── Indexes ────────────────────────────────────────────────────────────────────
// Note: email unique index is declared on the field itself (unique: true above).
// Declaring it again here would create a duplicate — intentionally omitted.

UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ deletedAt: 1 });
UserSchema.index({ 'lockout.lockedUntil': 1 });

// ── Pre-save hook – hash password ──────────────────────────────────────────────

UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Instance methods ───────────────────────────────────────────────────────────

/**
 * Compare a plain-text password against the stored hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Record a failed login attempt; lock account after 5 consecutive failures.
 */
UserSchema.methods.recordFailedLogin = async function () {
  this.lockout.failedAttempts += 1;
  this.lockout.lastFailedAt = new Date();
  if (this.lockout.failedAttempts >= 5) {
    // Lock for 15 minutes
    this.lockout.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  return this.save();
};

/**
 * Reset lockout counters after a successful login.
 */
UserSchema.methods.resetLockout = async function () {
  this.lockout.failedAttempts = 0;
  this.lockout.lockedUntil = null;
  this.lockout.lastFailedAt = null;
  this.lastLoginAt = new Date();
  return this.save();
};

// ── Model ──────────────────────────────────────────────────────────────────────

const User = mongoose.model('User', UserSchema);

module.exports = User;
