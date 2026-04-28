/**
 * Integration tests — Transaction Flow (Step 3)
 * Full HTTP layer tests using mongodb-memory-server.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

process.env.JWT_SECRET = 'test_access_secret_long_enough_to_be_valid_12345';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_long_enough_to_be_valid_123';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.AUTH_RATE_LIMIT_MAX = '1000';

const app = require('../../app');
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
  // Clear collections
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }

  // Register + login a fresh user
  const reg = await request(app).post('/api/v1/auth/register').send({
    firstName: 'Alice',
    lastName: 'Test',
    email: 'alice@test.com',
    password: 'TestPass1!',
  });

  accessToken = reg.body.data.tokens.accessToken;
  userId = reg.body.data.user._id;

  // Create a test account directly via the model
  const account = await Account.create({
    userId,
    name: 'Checking',
    accountType: 'checking',
    currentBalance: 1000,
    currency: 'USD',
    isManual: true,
  });
  accountId = account._id.toString();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function auth() {
  return ['Authorization', `Bearer ${accessToken}`];
}

const validTx = () => ({
  accountId,
  amount: 25.99,
  type: 'debit',
  date: new Date().toISOString(),
  description: 'STARBUCKS STORE #1234',
});

// ── POST /api/v1/transactions ─────────────────────────────────────────────────

describe('POST /api/v1/transactions', () => {
  it('should create a transaction and auto-categorise it', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(...auth())
      .send(validTx());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transaction.category).toBe('Food & Dining');
    expect(res.body.data.transaction.categorySource).toBe('auto');
    expect(res.body.data.transaction.isDuplicate).toBe(false);
  });

  it('should preserve a user-supplied category', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(...auth())
      .send({ ...validTx(), category: 'Shopping', categorySource: 'user' });

    expect(res.status).toBe(201);
    expect(res.body.data.transaction.category).toBe('Shopping');
    expect(res.body.data.transaction.categorySource).toBe('user');
  });

  it('should detect and flag a duplicate transaction', async () => {
    const tx = validTx();
    await request(app).post('/api/v1/transactions').set(...auth()).send(tx);
    const dup = await request(app).post('/api/v1/transactions').set(...auth()).send(tx);

    expect(dup.status).toBe(201);
    expect(dup.body.data.transaction.isDuplicate).toBe(true);
    expect(dup.body.data.transaction.duplicateOf).toBeTruthy();
  });

  it('should reject a transaction with amount = 0', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(...auth())
      .send({ ...validTx(), amount: 0 });

    expect(res.status).toBe(422);
  });

  it('should reject an invalid account ID', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(...auth())
      .send({ ...validTx(), accountId: 'not-a-valid-id' });

    expect(res.status).toBe(422);
  });

  it('should reject a transaction for an account that does not belong to the user', async () => {
    const fakeAccountId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(...auth())
      .send({ ...validTx(), accountId: fakeAccountId });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('should require authentication', async () => {
    const res = await request(app).post('/api/v1/transactions').send(validTx());
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/transactions ──────────────────────────────────────────────────

describe('GET /api/v1/transactions', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/transactions').set(...auth()).send(validTx());
    await request(app).post('/api/v1/transactions').set(...auth()).send({
      ...validTx(),
      description: 'AMAZON.COM PURCHASE',
      amount: 49.99,
      category: 'Shopping',
      categorySource: 'user',
    });
  });

  it('should return paginated transactions', async () => {
    const res = await request(app).get('/api/v1/transactions').set(...auth());
    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('page');
    expect(res.body.data).toHaveProperty('pages');
  });

  it('should filter by category', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?category=Shopping')
      .set(...auth());

    expect(res.status).toBe(200);
    res.body.data.transactions.forEach((t) => {
      expect(t.category).toBe('Shopping');
    });
  });

  it('should filter by accountId', async () => {
    const res = await request(app)
      .get(`/api/v1/transactions?accountId=${accountId}`)
      .set(...auth());

    expect(res.status).toBe(200);
    res.body.data.transactions.forEach((t) => {
      expect(t.accountId).toBe(accountId);
    });
  });

  it('should search by description keyword', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?search=starbucks')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(1);
  });

  it('should respect pagination limits', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?limit=1&page=1')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBe(1);
  });
});

// ── GET /api/v1/transactions/summary ─────────────────────────────────────────

describe('GET /api/v1/transactions/summary', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/transactions').set(...auth()).send(validTx());
  });

  it('should return category spending totals', async () => {
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();

    const res = await request(app)
      .get(`/api/v1/transactions/summary?startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should require startDate and endDate', async () => {
    const res = await request(app).get('/api/v1/transactions/summary').set(...auth());
    expect(res.status).toBe(422);
  });
});

// ── PATCH /api/v1/transactions/:id ────────────────────────────────────────────

describe('PATCH /api/v1/transactions/:id', () => {
  let txId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/transactions').set(...auth()).send(validTx());
    txId = res.body.data.transaction._id;
  });

  it('should update description and category', async () => {
    const res = await request(app)
      .patch(`/api/v1/transactions/${txId}`)
      .set(...auth())
      .send({ description: 'Updated Description', category: 'Entertainment', notes: 'test note' });

    expect(res.status).toBe(200);
    expect(res.body.data.transaction.description).toBe('Updated Description');
    expect(res.body.data.transaction.category).toBe('Entertainment');
    expect(res.body.data.transaction.categorySource).toBe('user');
  });

  it('should return 404 for a non-existent transaction', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`/api/v1/transactions/${fakeId}`)
      .set(...auth())
      .send({ notes: 'test' });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/v1/transactions/:id ──────────────────────────────────────────

describe('DELETE /api/v1/transactions/:id', () => {
  let txId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/transactions').set(...auth()).send(validTx());
    txId = res.body.data.transaction._id;
  });

  it('should soft-delete a transaction', async () => {
    const res = await request(app)
      .delete(`/api/v1/transactions/${txId}`)
      .set(...auth());

    expect(res.status).toBe(200);

    // Should no longer appear in list
    const list = await request(app).get('/api/v1/transactions').set(...auth());
    const found = list.body.data.transactions.find((t) => t._id === txId);
    expect(found).toBeUndefined();
  });
});

// ── PATCH /api/v1/transactions/:id/flag ──────────────────────────────────────

describe('PATCH /api/v1/transactions/:id/flag', () => {
  let txId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/transactions').set(...auth()).send(validTx());
    txId = res.body.data.transaction._id;
  });

  it('should flag a transaction as fraudulent', async () => {
    const res = await request(app)
      .patch(`/api/v1/transactions/${txId}/flag`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.transaction.isFlagged).toBe(true);
    expect(res.body.data.transaction.fraudMeta.flaggedBy).toBe('user');
  });

  it('should toggle flag off on second call', async () => {
    await request(app).patch(`/api/v1/transactions/${txId}/flag`).set(...auth());
    const res = await request(app).patch(`/api/v1/transactions/${txId}/flag`).set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.transaction.isFlagged).toBe(false);
  });
});
