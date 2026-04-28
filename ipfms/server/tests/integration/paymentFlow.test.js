/**
 * Integration tests — Payment Flow (Step 5)
 * Full HTTP layer tests using mongodb-memory-server.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request  = require('supertest');

process.env.JWT_SECRET = 'test_access_secret_long_enough_to_be_valid_12345';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_long_enough_to_be_valid_123';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.AUTH_RATE_LIMIT_MAX = '1000';

const app     = require('../../app');
const Account = require('../../src/models/Account');

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
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }

  const reg = await request(app).post('/api/v1/auth/register').send({
    firstName: 'Pay',
    lastName: 'Tester',
    email: 'pay@test.com',
    password: 'TestPass1!',
  });

  accessToken = reg.body.data.tokens.accessToken;
  userId = reg.body.data.user._id;

  const account = await Account.create({
    userId,
    name: 'Checking',
    accountType: 'checking',
    currentBalance: 5000,
    currency: 'USD',
    isManual: true,
  });
  accountId = account._id.toString();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function auth() {
  return ['Authorization', `Bearer ${accessToken}`];
}

const nextMonth = new Date();
nextMonth.setMonth(nextMonth.getMonth() + 1);

const validPayment = () => ({
  accountId,
  name: 'Netflix Subscription',
  payeeName: 'Netflix Inc',
  amount: 15.99,
  frequency: 'monthly',
  startDate: new Date().toISOString(),
  nextDueDate: nextMonth.toISOString(),
  category: 'Entertainment',
});

// ── POST /api/v1/payments ─────────────────────────────────────────────────────

describe('POST /api/v1/payments', () => {
  it('should create a scheduled payment', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set(...auth())
      .send(validPayment());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment.name).toBe('Netflix Subscription');
    expect(res.body.data.payment.status).toBe('active');
    expect(res.body.data.payment.frequency).toBe('monthly');
  });

  it('should reject a payment with a missing required field (payeeName)', async () => {
    const { payeeName, ...rest } = validPayment(); // eslint-disable-line no-unused-vars
    const res = await request(app)
      .post('/api/v1/payments')
      .set(...auth())
      .send(rest);

    expect(res.status).toBe(422);
  });

  it('should reject a payment with amount = 0', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set(...auth())
      .send({ ...validPayment(), amount: 0 });

    expect(res.status).toBe(422);
  });

  it('should reject an invalid account ID', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set(...auth())
      .send({ ...validPayment(), accountId: 'not-a-valid-id' });

    expect(res.status).toBe(422);
  });

  it('should reject a payment for an account not belonging to the user', async () => {
    const fakeAccountId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/v1/payments')
      .set(...auth())
      .send({ ...validPayment(), accountId: fakeAccountId });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('should require authentication', async () => {
    const res = await request(app).post('/api/v1/payments').send(validPayment());
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/payments ──────────────────────────────────────────────────────

describe('GET /api/v1/payments', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/payments').set(...auth()).send(validPayment());
    await request(app).post('/api/v1/payments').set(...auth()).send({
      ...validPayment(),
      name: 'Spotify',
      amount: 9.99,
      frequency: 'monthly',
    });
  });

  it('should return a paginated list of payments', async () => {
    const res = await request(app).get('/api/v1/payments').set(...auth());
    expect(res.status).toBe(200);
    expect(res.body.data.payments.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('pages');
  });

  it('should filter by status', async () => {
    const res = await request(app)
      .get('/api/v1/payments?status=active')
      .set(...auth());

    expect(res.status).toBe(200);
    res.body.data.payments.forEach((p) => expect(p.status).toBe('active'));
  });

  it('should filter by frequency', async () => {
    const res = await request(app)
      .get('/api/v1/payments?frequency=monthly')
      .set(...auth());

    expect(res.status).toBe(200);
    res.body.data.payments.forEach((p) => expect(p.frequency).toBe('monthly'));
  });
});

// ── GET /api/v1/payments/:id ──────────────────────────────────────────────────

describe('GET /api/v1/payments/:id', () => {
  let paymentId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/payments').set(...auth()).send(validPayment());
    paymentId = res.body.data.payment._id;
  });

  it('should return the payment by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/payments/${paymentId}`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.payment._id).toBe(paymentId);
  });

  it('should return 404 for a non-existent ID', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/v1/payments/${fakeId}`)
      .set(...auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PAYMENT_NOT_FOUND');
  });
});

// ── PATCH /api/v1/payments/:id ────────────────────────────────────────────────

describe('PATCH /api/v1/payments/:id', () => {
  let paymentId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/payments').set(...auth()).send(validPayment());
    paymentId = res.body.data.payment._id;
  });

  it('should update amount and name', async () => {
    const res = await request(app)
      .patch(`/api/v1/payments/${paymentId}`)
      .set(...auth())
      .send({ name: 'Netflix Standard', amount: 22.99 });

    expect(res.status).toBe(200);
    expect(res.body.data.payment.name).toBe('Netflix Standard');
    expect(res.body.data.payment.amount).toBeCloseTo(22.99);
  });

  it('should return 404 for a non-existent payment', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`/api/v1/payments/${fakeId}`)
      .set(...auth())
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/v1/payments/:id ───────────────────────────────────────────────

describe('DELETE /api/v1/payments/:id', () => {
  let paymentId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/payments').set(...auth()).send(validPayment());
    paymentId = res.body.data.payment._id;
  });

  it('should cancel and soft-delete the payment', async () => {
    const del = await request(app)
      .delete(`/api/v1/payments/${paymentId}`)
      .set(...auth());

    expect(del.status).toBe(200);

    // Should no longer appear in list
    const list = await request(app).get('/api/v1/payments').set(...auth());
    const found = list.body.data.payments.find((p) => p._id === paymentId);
    expect(found).toBeUndefined();
  });
});

// ── POST /api/v1/payments/:id/execute ────────────────────────────────────────

describe('POST /api/v1/payments/:id/execute', () => {
  let paymentId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/payments').set(...auth()).send(validPayment());
    paymentId = res.body.data.payment._id;
  });

  it('should execute the payment and create a transaction', async () => {
    const res = await request(app)
      .post(`/api/v1/payments/${paymentId}/execute`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.skipped).toBe(false);
    expect(res.body.data.transaction).not.toBeNull();
    expect(res.body.data.transaction.amount).toBeCloseTo(15.99);
  });

  it('should advance the nextDueDate after execution', async () => {
    const before = (
      await request(app).get(`/api/v1/payments/${paymentId}`).set(...auth())
    ).body.data.payment.nextDueDate;

    await request(app).post(`/api/v1/payments/${paymentId}/execute`).set(...auth());

    const after = (
      await request(app).get(`/api/v1/payments/${paymentId}`).set(...auth())
    ).body.data.payment.nextDueDate;

    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it('should skip when balance is insufficient and skipIfInsufficientFunds = true', async () => {
    const bigRes = await request(app).post('/api/v1/payments').set(...auth()).send({
      ...validPayment(),
      name: 'Huge Payment',
      amount: 99999,
      skipIfInsufficientFunds: true,
    });
    const bigId = bigRes.body.data.payment._id;

    const res = await request(app)
      .post(`/api/v1/payments/${bigId}/execute`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.skipped).toBe(true);
    expect(res.body.data.transaction).toBeNull();
  });

  it('should return 404 for a non-existent payment', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/v1/payments/${fakeId}/execute`)
      .set(...auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PAYMENT_NOT_FOUND');
  });
});

// ── PATCH /api/v1/payments/:id/pause & /resume ───────────────────────────────

describe('PATCH pause and resume', () => {
  let paymentId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/payments').set(...auth()).send(validPayment());
    paymentId = res.body.data.payment._id;
  });

  it('should pause an active payment', async () => {
    const res = await request(app)
      .patch(`/api/v1/payments/${paymentId}/pause`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('paused');
  });

  it('should resume a paused payment', async () => {
    await request(app).patch(`/api/v1/payments/${paymentId}/pause`).set(...auth());
    const res = await request(app)
      .patch(`/api/v1/payments/${paymentId}/resume`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('active');
  });

  it('should reject pausing an already-paused payment', async () => {
    await request(app).patch(`/api/v1/payments/${paymentId}/pause`).set(...auth());
    const res = await request(app)
      .patch(`/api/v1/payments/${paymentId}/pause`)
      .set(...auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYMENT_NOT_ACTIVE');
  });

  it('should reject resuming an active (non-paused) payment', async () => {
    const res = await request(app)
      .patch(`/api/v1/payments/${paymentId}/resume`)
      .set(...auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYMENT_NOT_PAUSED');
  });

  it('should reject executing a paused payment', async () => {
    await request(app).patch(`/api/v1/payments/${paymentId}/pause`).set(...auth());
    const res = await request(app)
      .post(`/api/v1/payments/${paymentId}/execute`)
      .set(...auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYMENT_NOT_ACTIVE');
  });
});

// ── GET /api/v1/payments/process ─────────────────────────────────────────────

describe('GET /api/v1/payments/process', () => {
  it('should process due payments and return a summary', async () => {
    // Create a payment with a past due date
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 1);

    await request(app).post('/api/v1/payments').set(...auth()).send({
      ...validPayment(),
      name: 'Overdue Bill',
      nextDueDate: pastDue.toISOString(),
    });

    const res = await request(app).get('/api/v1/payments/process').set(...auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('succeeded');
    expect(res.body.data).toHaveProperty('failed');
    expect(res.body.data).toHaveProperty('skipped');
    // At least one payment was processed
    const total = res.body.data.succeeded + res.body.data.failed + res.body.data.skipped;
    expect(total).toBeGreaterThanOrEqual(1);
  });
});
