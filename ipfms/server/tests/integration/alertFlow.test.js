/**
 * Integration tests — Alert Flow (Step 5)
 * Full HTTP layer tests using mongodb-memory-server.
 *
 * Covers:
 *   GET    /api/v1/alerts              (list, filter)
 *   POST   /api/v1/alerts/scan         (anomaly scan, deduplication)
 *   GET    /api/v1/alerts/:id          (single alert)
 *   PATCH  /api/v1/alerts/:id/acknowledge
 *   PATCH  /api/v1/alerts/:id/resolve  (feedback loop: confirmed_fraud + false_positive)
 *   PATCH  /api/v1/alerts/:id/dismiss
 *   Error cases: 404, 409, 401
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request  = require('supertest');

process.env.JWT_SECRET              = 'test_access_secret_long_enough_to_be_valid_12345';
process.env.JWT_REFRESH_SECRET      = 'test_refresh_secret_long_enough_to_be_valid_123';
process.env.JWT_EXPIRES_IN          = '15m';
process.env.JWT_REFRESH_EXPIRES_IN  = '7d';
process.env.NODE_ENV                = 'test';
process.env.RATE_LIMIT_WINDOW_MS    = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.AUTH_RATE_LIMIT_MAX     = '1000';

const app          = require('../../app');
const Account      = require('../../src/models/Account');
const Transaction  = require('../../src/models/Transaction');
const AnomalyAlert = require('../../src/models/AnomalyAlert');

let mongoServer;
let accessToken;
let userId;
let accountId;

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections before each test
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }

  // Register a fresh user
  const reg = await request(app).post('/api/v1/auth/register').send({
    firstName: 'Alert',
    lastName:  'Tester',
    email:     'alert@test.com',
    password:  'TestPass1!',
  });

  accessToken = reg.body.data.tokens.accessToken;
  userId      = reg.body.data.user._id;

  // Create a bank account with a comfortable balance
  const account = await Account.create({
    userId,
    name:           'Checking',
    accountType:    'checking',
    currentBalance: 10000,
    currency:       'USD',
    isManual:       true,
  });
  accountId = account._id.toString();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function auth() {
  return ['Authorization', `Bearer ${accessToken}`];
}

/**
 * Seed `count` debit transactions in the same category (for Z-score history).
 * All have the same amount so we control the baseline precisely.
 */
async function seedCategoryHistory(category, amount, count) {
  const docs = [];
  for (let i = 0; i < count; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (i + 2)); // start from 2 days ago
    docs.push({
      userId,
      accountId,
      amount,
      type:        'debit',
      date,
      description: `${category} regular spend`,
      category,
      categorySource: 'auto',
      deletedAt: null,
      isDuplicate: false,
    });
  }
  await Transaction.insertMany(docs);
}

/**
 * Create a single transaction document (not via API to avoid triggering
 * auto-analysis — we test that separately via /scan).
 */
async function seedTransaction(overrides = {}) {
  return Transaction.create({
    userId,
    accountId,
    amount:        50,
    type:          'debit',
    date:          new Date(),
    description:   'Test Transaction',
    category:      'Groceries',
    categorySource: 'auto',
    deletedAt:     null,
    isDuplicate:   false,
    ...overrides,
  });
}

// ── GET /api/v1/alerts ────────────────────────────────────────────────────────

describe('GET /api/v1/alerts', () => {
  beforeEach(async () => {
    // Seed a couple of alerts directly
    await AnomalyAlert.insertMany([
      {
        userId,
        accountId,
        alertType: 'unusual_amount',
        severity:  'medium',
        title:     'Unusual amount',
        description: 'Test alert 1',
        status:    'open',
      },
      {
        userId,
        accountId,
        alertType: 'large_transfer',
        severity:  'high',
        title:     'Large transfer',
        description: 'Test alert 2',
        status:    'acknowledged',
      },
    ]);
  });

  it('should return a paginated list of alerts', async () => {
    const res = await request(app).get('/api/v1/alerts').set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alerts.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('pages');
  });

  it('should filter by status', async () => {
    const res = await request(app)
      .get('/api/v1/alerts?status=open')
      .set(...auth());

    expect(res.status).toBe(200);
    res.body.data.alerts.forEach((a) => expect(a.status).toBe('open'));
  });

  it('should filter by severity', async () => {
    const res = await request(app)
      .get('/api/v1/alerts?severity=high')
      .set(...auth());

    expect(res.status).toBe(200);
    res.body.data.alerts.forEach((a) => expect(a.severity).toBe('high'));
  });

  it('should filter by alertType', async () => {
    const res = await request(app)
      .get('/api/v1/alerts?alertType=large_transfer')
      .set(...auth());

    expect(res.status).toBe(200);
    res.body.data.alerts.forEach((a) => expect(a.alertType).toBe('large_transfer'));
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/v1/alerts');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/alerts/:id ────────────────────────────────────────────────────

describe('GET /api/v1/alerts/:id', () => {
  let alertId;

  beforeEach(async () => {
    const alert = await AnomalyAlert.create({
      userId,
      alertType:   'unusual_amount',
      severity:    'medium',
      title:       'Single alert',
      description: 'Test',
      status:      'open',
    });
    alertId = alert._id.toString();
  });

  it('should return the alert by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/alerts/${alertId}`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.alert._id).toBe(alertId);
  });

  it('should return 404 for a non-existent alert', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/v1/alerts/${fakeId}`)
      .set(...auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ALERT_NOT_FOUND');
  });
});

// ── POST /api/v1/alerts/scan ──────────────────────────────────────────────────

describe('POST /api/v1/alerts/scan', () => {
  it('should return txScanned and alertsCreated in the response', async () => {
    const res = await request(app)
      .post('/api/v1/alerts/scan')
      .set(...auth())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('txScanned');
    expect(res.body.data).toHaveProperty('alertsCreated');
  });

  it('should create a large_transfer alert when a transaction ≥ $1000 is scanned', async () => {
    await seedTransaction({ amount: 2500, description: 'Wire Transfer', category: 'Transfers' });

    const res = await request(app)
      .post('/api/v1/alerts/scan')
      .set(...auth())
      .send({ lookbackHours: 48 });

    expect(res.status).toBe(200);
    expect(res.body.data.alertsCreated).toBeGreaterThanOrEqual(1);

    const alert = await AnomalyAlert.findOne({ userId, alertType: 'large_transfer' });
    expect(alert).not.toBeNull();
    expect(alert.severity).toBe('medium'); // 2500 < 5000 threshold
  });

  it('should create a high-severity large_transfer alert for transactions ≥ $5000', async () => {
    await seedTransaction({ amount: 6000, description: 'Large Wire', category: 'Transfers' });

    await request(app)
      .post('/api/v1/alerts/scan')
      .set(...auth())
      .send({ lookbackHours: 48 });

    const alert = await AnomalyAlert.findOne({ userId, alertType: 'large_transfer' });
    expect(alert).not.toBeNull();
    expect(alert.severity).toBe('high');
  });

  it('should create an unusual_amount alert when Z-score ≥ 2.0 with sufficient history', async () => {
    // Seed 10 identical $20 grocery transactions → stdDev = 0 edge case avoided by using spread
    // Use varied history: amounts around $20 to get reliable baseline
    await seedCategoryHistory('Groceries', 20, 10);

    // Now add a $200 outlier — far outside the $20 baseline
    await seedTransaction({ amount: 200, category: 'Groceries', description: 'Huge grocery run' });

    await request(app)
      .post('/api/v1/alerts/scan')
      .set(...auth())
      .send({ lookbackHours: 48 });

    const alert = await AnomalyAlert.findOne({ userId, alertType: 'unusual_amount' });
    expect(alert).not.toBeNull();
    expect(['medium', 'high', 'critical']).toContain(alert.severity);
    expect(alert.detectionMeta.zScore).not.toBeNull();
    expect(alert.detectionMeta.zScore).toBeGreaterThan(2);
  });

  it('should create a rapid_succession alert when ≥ 3 transactions occur within 60 minutes', async () => {
    // Create 3 transactions within a 30-minute window
    const base = new Date();
    await Transaction.insertMany([
      { userId, accountId, amount: 10, type: 'debit', date: new Date(base.getTime()),         description: 'Tx A', category: 'Misc', categorySource: 'auto', deletedAt: null, isDuplicate: false },
      { userId, accountId, amount: 15, type: 'debit', date: new Date(base.getTime() + 600000),  description: 'Tx B', category: 'Misc', categorySource: 'auto', deletedAt: null, isDuplicate: false },
      { userId, accountId, amount: 20, type: 'debit', date: new Date(base.getTime() + 1200000), description: 'Tx C', category: 'Misc', categorySource: 'auto', deletedAt: null, isDuplicate: false },
    ]);

    await request(app)
      .post('/api/v1/alerts/scan')
      .set(...auth())
      .send({ lookbackHours: 48 });

    const alert = await AnomalyAlert.findOne({ userId, alertType: 'rapid_succession' });
    expect(alert).not.toBeNull();
    expect(alert.severity).toBe('high');
  });

  it('should NOT re-create an alert for the same transaction + alertType on a second scan', async () => {
    await seedTransaction({ amount: 3000, description: 'Big purchase', category: 'Shopping' });

    // First scan
    await request(app).post('/api/v1/alerts/scan').set(...auth()).send({ lookbackHours: 48 });
    const countAfterFirst = await AnomalyAlert.countDocuments({ userId, alertType: 'large_transfer' });

    // Second scan — should not create a duplicate
    await request(app).post('/api/v1/alerts/scan').set(...auth()).send({ lookbackHours: 48 });
    const countAfterSecond = await AnomalyAlert.countDocuments({ userId, alertType: 'large_transfer' });

    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it('should accept a custom lookbackHours value', async () => {
    const res = await request(app)
      .post('/api/v1/alerts/scan')
      .set(...auth())
      .send({ lookbackHours: 72 });

    expect(res.status).toBe(200);
  });

  it('should reject lookbackHours > 168 (7 days)', async () => {
    const res = await request(app)
      .post('/api/v1/alerts/scan')
      .set(...auth())
      .send({ lookbackHours: 200 });

    expect(res.status).toBe(422);
  });
});

// ── PATCH /api/v1/alerts/:id/acknowledge ─────────────────────────────────────

describe('PATCH /api/v1/alerts/:id/acknowledge', () => {
  let alertId;

  beforeEach(async () => {
    const alert = await AnomalyAlert.create({
      userId,
      alertType:   'unusual_amount',
      severity:    'medium',
      title:       'Ack test',
      description: 'Test',
      status:      'open',
    });
    alertId = alert._id.toString();
  });

  it('should move an open alert to acknowledged', async () => {
    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}/acknowledge`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.alert.status).toBe('acknowledged');
    expect(res.body.data.alert.acknowledgedAt).not.toBeNull();
  });

  it('should return 409 when acknowledging a non-open alert', async () => {
    // Acknowledge first
    await request(app).patch(`/api/v1/alerts/${alertId}/acknowledge`).set(...auth());
    // Try again
    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}/acknowledge`)
      .set(...auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALERT_NOT_OPEN');
  });

  it('should return 404 for a non-existent alert', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`/api/v1/alerts/${fakeId}/acknowledge`)
      .set(...auth());

    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/v1/alerts/:id/resolve ─────────────────────────────────────────

describe('PATCH /api/v1/alerts/:id/resolve', () => {
  let alertId;
  let transactionId;

  beforeEach(async () => {
    // Create a transaction we can link to the alert
    const tx = await seedTransaction({ amount: 500 });
    transactionId = tx._id.toString();

    const alert = await AnomalyAlert.create({
      userId,
      accountId,
      transactionId: tx._id,
      alertType:     'unusual_amount',
      severity:      'medium',
      title:         'Resolve test',
      description:   'Test',
      status:        'open',
    });
    alertId = alert._id.toString();
  });

  it('should resolve an alert with action=user_verified', async () => {
    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}/resolve`)
      .set(...auth())
      .send({ action: 'user_verified', notes: 'I made this purchase' });

    expect(res.status).toBe(200);
    expect(res.body.data.alert.status).toBe('resolved');
    expect(res.body.data.alert.resolution.action).toBe('user_verified');
  });

  // ── Feedback loop: confirmed_fraud ──────────────────────────────────────────

  it('should flag the linked transaction when action=confirmed_fraud', async () => {
    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}/resolve`)
      .set(...auth())
      .send({ action: 'confirmed_fraud', notes: 'Unauthorised charge' });

    expect(res.status).toBe(200);
    expect(res.body.data.alert.resolution.action).toBe('confirmed_fraud');

    const tx = await Transaction.findById(transactionId);
    expect(tx.isFlagged).toBe(true);
    expect(tx.fraudMeta.flaggedBy).toBe('user');
  });

  // ── Feedback loop: false_positive ──────────────────────────────────────────

  it('should unflag the linked transaction when action=false_positive', async () => {
    // Pre-flag the transaction
    await Transaction.updateOne(
      { _id: transactionId },
      { $set: { isFlagged: true, 'fraudMeta.flaggedBy': 'system', 'fraudMeta.flaggedAt': new Date() } }
    );

    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}/resolve`)
      .set(...auth())
      .send({ action: 'false_positive' });

    expect(res.status).toBe(200);
    expect(res.body.data.alert.resolution.action).toBe('false_positive');

    const tx = await Transaction.findById(transactionId);
    expect(tx.isFlagged).toBe(false);
    expect(tx.fraudMeta.resolvedAt).not.toBeNull();
  });

  it('should return 409 when resolving an already-resolved alert', async () => {
    await request(app)
      .patch(`/api/v1/alerts/${alertId}/resolve`)
      .set(...auth())
      .send({ action: 'user_verified' });

    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}/resolve`)
      .set(...auth())
      .send({ action: 'user_verified' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALERT_ALREADY_RESOLVED');
  });

  it('should reject an invalid action value', async () => {
    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}/resolve`)
      .set(...auth())
      .send({ action: 'delete_everything' });

    expect(res.status).toBe(422);
  });

  it('should reject a resolve request with no action field', async () => {
    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}/resolve`)
      .set(...auth())
      .send({});

    expect(res.status).toBe(422);
  });
});

// ── PATCH /api/v1/alerts/:id/dismiss ─────────────────────────────────────────

describe('PATCH /api/v1/alerts/:id/dismiss', () => {
  let alertId;

  beforeEach(async () => {
    const alert = await AnomalyAlert.create({
      userId,
      alertType:   'large_transfer',
      severity:    'medium',
      title:       'Dismiss test',
      description: 'Test',
      status:      'open',
    });
    alertId = alert._id.toString();
  });

  it('should dismiss an open alert', async () => {
    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}/dismiss`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.alert.status).toBe('dismissed');
  });

  it('should dismiss an acknowledged alert', async () => {
    await request(app).patch(`/api/v1/alerts/${alertId}/acknowledge`).set(...auth());
    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}/dismiss`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.alert.status).toBe('dismissed');
  });

  it('should return 409 when dismissing an already-dismissed alert', async () => {
    await request(app).patch(`/api/v1/alerts/${alertId}/dismiss`).set(...auth());
    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}/dismiss`)
      .set(...auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALERT_ALREADY_RESOLVED');
  });
});

// ── Transaction flagging via scan ─────────────────────────────────────────────

describe('Transaction flagging via anomaly scan', () => {
  it('should set isFlagged=true on a transaction that triggers a high-severity alert', async () => {
    const tx = await seedTransaction({ amount: 6000, description: 'Huge wire', category: 'Transfers' });

    await request(app)
      .post('/api/v1/alerts/scan')
      .set(...auth())
      .send({ lookbackHours: 48 });

    const updated = await Transaction.findById(tx._id);
    expect(updated.isFlagged).toBe(true);
    expect(updated.fraudMeta.flaggedBy).toBe('system');
    expect(updated.fraudMeta.flaggedAt).not.toBeNull();
  });

  it('should NOT flag a transaction with a medium-severity large_transfer alert ($1000–$4999)', async () => {
    const tx = await seedTransaction({ amount: 1500, description: 'Mid-size wire', category: 'Transfers' });

    await request(app)
      .post('/api/v1/alerts/scan')
      .set(...auth())
      .send({ lookbackHours: 48 });

    const updated = await Transaction.findById(tx._id);
    // large_transfer medium → no flag, only high/critical trigger flag
    expect(updated.isFlagged).toBe(false);
  });
});
