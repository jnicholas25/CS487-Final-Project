/**
 * Integration tests — Investment Flow (Step 7)
 * Full HTTP layer tests using mongodb-memory-server.
 *
 * Covers:
 *   POST   /api/v1/investments              (create, validation)
 *   GET    /api/v1/investments              (list, filter by assetType)
 *   GET    /api/v1/investments/portfolio    (portfolio summary)
 *   GET    /api/v1/investments/performance  (return calculations)
 *   GET    /api/v1/investments/:id          (single, 404)
 *   PATCH  /api/v1/investments/:id          (update price, timestamps)
 *   DELETE /api/v1/investments/:id          (soft delete)
 *   POST   /api/v1/investments/:id/dividends (add dividend)
 *   GET    /api/v1/investments/dividends/summary
 *   GET    /api/v1/investments/dividends/history
 *   GET    /api/v1/reports/spending         (spending report)
 *   GET    /api/v1/reports/income           (income report)
 *   GET    /api/v1/reports/net-worth        (net-worth snapshot)
 *   GET    /api/v1/reports/charts/*         (chart data endpoints)
 *   Error cases: 401, 404, 422
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

const app        = require('../../app');
const Account    = require('../../src/models/Account');
const Transaction = require('../../src/models/Transaction');

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
    firstName: 'Invest',
    lastName:  'Tester',
    email:     'invest@test.com',
    password:  'TestPass1!',
  });

  accessToken = reg.body.data.tokens.accessToken;
  userId      = reg.body.data.user._id;

  const account = await Account.create({
    userId,
    name:           'Brokerage',
    accountType:    'investment',
    currentBalance: 50000,
    currency:       'USD',
    isManual:       true,
  });
  accountId = account._id.toString();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function auth() {
  return ['Authorization', `Bearer ${accessToken}`];
}

const validHolding = () => ({
  symbol:           'AAPL',
  name:             'Apple Inc.',
  assetType:        'stock',
  quantity:         10,
  averageCostBasis: 150,
  currentPrice:     180,
  currency:         'USD',
  exchange:         'NASDAQ',
  purchaseDate:     '2023-01-15',
});

// ── POST /api/v1/investments ──────────────────────────────────────────────────

describe('POST /api/v1/investments', () => {
  it('should create a new holding', async () => {
    const res = await request(app)
      .post('/api/v1/investments')
      .set(...auth())
      .send(validHolding());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.investment.symbol).toBe('AAPL');
    expect(res.body.data.investment.quantity).toBe(10);
    expect(res.body.data.investment.averageCostBasis).toBe(150);
  });

  it('should reject a holding without symbol', async () => {
    const { symbol, ...rest } = validHolding(); // eslint-disable-line no-unused-vars
    const res = await request(app)
      .post('/api/v1/investments')
      .set(...auth())
      .send(rest);

    expect(res.status).toBe(422);
  });

  it('should reject a negative quantity', async () => {
    const res = await request(app)
      .post('/api/v1/investments')
      .set(...auth())
      .send({ ...validHolding(), quantity: -5 });

    expect(res.status).toBe(422);
  });

  it('should require authentication', async () => {
    const res = await request(app).post('/api/v1/investments').send(validHolding());
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/investments ───────────────────────────────────────────────────

describe('GET /api/v1/investments', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/investments').set(...auth()).send(validHolding());
    await request(app).post('/api/v1/investments').set(...auth()).send({
      ...validHolding(), symbol: 'BTC', name: 'Bitcoin', assetType: 'crypto', exchange: null,
    });
  });

  it('should return a paginated list of holdings', async () => {
    const res = await request(app).get('/api/v1/investments').set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.investments.length).toBe(2);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('pages');
  });

  it('should filter by assetType', async () => {
    const res = await request(app)
      .get('/api/v1/investments?assetType=crypto')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.investments.length).toBe(1);
    expect(res.body.data.investments[0].assetType).toBe('crypto');
  });
});

// ── GET /api/v1/investments/portfolio ────────────────────────────────────────

describe('GET /api/v1/investments/portfolio', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/investments').set(...auth()).send(validHolding());
  });

  it('should return portfolio summary with aggregated totals', async () => {
    const res = await request(app)
      .get('/api/v1/investments/portfolio')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('holdings');
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data.summary.totalHoldings).toBe(1);
    // cost = 10 × 150 = 1500, value = 10 × 180 = 1800
    expect(res.body.data.summary.totalCostBasis).toBeCloseTo(1500, 2);
    expect(res.body.data.summary.totalCurrentValue).toBeCloseTo(1800, 2);
    expect(res.body.data.summary.totalGainLoss).toBeCloseTo(300, 2);
  });
});

// ── GET /api/v1/investments/performance ──────────────────────────────────────

describe('GET /api/v1/investments/performance', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/investments').set(...auth()).send(validHolding());
  });

  it('should return performance metrics for each holding', async () => {
    const res = await request(app)
      .get('/api/v1/investments/performance')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.holdings.length).toBe(1);
    expect(res.body.data.holdings[0].symbol).toBe('AAPL');
    // gain = (180-150)×10 = 300, pct = 20%
    expect(res.body.data.holdings[0].totalReturnPct).toBeCloseTo(20, 1);
    expect(res.body.data.portfolio).toHaveProperty('totalInvested');
  });
});

// ── GET /api/v1/investments/:id ───────────────────────────────────────────────

describe('GET /api/v1/investments/:id', () => {
  let holdingId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/investments').set(...auth()).send(validHolding());
    holdingId = res.body.data.investment._id;
  });

  it('should return the holding by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/investments/${holdingId}`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.investment._id).toBe(holdingId);
    expect(res.body.data.investment.symbol).toBe('AAPL');
  });

  it('should return 404 for a non-existent holding', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/v1/investments/${fakeId}`)
      .set(...auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INVESTMENT_NOT_FOUND');
  });
});

// ── PATCH /api/v1/investments/:id ────────────────────────────────────────────

describe('PATCH /api/v1/investments/:id', () => {
  let holdingId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/investments').set(...auth()).send(validHolding());
    holdingId = res.body.data.investment._id;
  });

  it('should update the current price', async () => {
    const res = await request(app)
      .patch(`/api/v1/investments/${holdingId}`)
      .set(...auth())
      .send({ currentPrice: 200 });

    expect(res.status).toBe(200);
    expect(res.body.data.investment.currentPrice).toBe(200);
    expect(res.body.data.investment.priceUpdatedAt).not.toBeNull();
  });

  it('should update quantity and name', async () => {
    const res = await request(app)
      .patch(`/api/v1/investments/${holdingId}`)
      .set(...auth())
      .send({ quantity: 15, name: 'Apple Inc. (Updated)' });

    expect(res.status).toBe(200);
    expect(res.body.data.investment.quantity).toBe(15);
    expect(res.body.data.investment.name).toBe('Apple Inc. (Updated)');
  });
});

// ── DELETE /api/v1/investments/:id ───────────────────────────────────────────

describe('DELETE /api/v1/investments/:id', () => {
  let holdingId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/investments').set(...auth()).send(validHolding());
    holdingId = res.body.data.investment._id;
  });

  it('should soft-delete the holding', async () => {
    const del = await request(app)
      .delete(`/api/v1/investments/${holdingId}`)
      .set(...auth());

    expect(del.status).toBe(200);

    // Should not appear in list
    const list = await request(app).get('/api/v1/investments').set(...auth());
    const found = list.body.data.investments.find((h) => h._id === holdingId);
    expect(found).toBeUndefined();
  });
});

// ── POST /api/v1/investments/:id/dividends ────────────────────────────────────

describe('POST /api/v1/investments/:id/dividends', () => {
  let holdingId;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/investments').set(...auth()).send(validHolding());
    holdingId = res.body.data.investment._id;
  });

  it('should add a dividend record to the holding', async () => {
    const res = await request(app)
      .post(`/api/v1/investments/${holdingId}/dividends`)
      .set(...auth())
      .send({ amount: 23.50, date: '2024-09-15', type: 'cash', notes: 'Q3 dividend' });

    expect(res.status).toBe(201);
    const divs = res.body.data.investment.dividends;
    expect(divs.length).toBe(1);
    expect(divs[0].amount).toBeCloseTo(23.50, 2);
  });

  it('should reject a dividend with negative amount', async () => {
    const res = await request(app)
      .post(`/api/v1/investments/${holdingId}/dividends`)
      .set(...auth())
      .send({ amount: -5, date: '2024-09-15' });

    expect(res.status).toBe(422);
  });
});

// ── GET /api/v1/investments/dividends/summary ─────────────────────────────────

describe('GET /api/v1/investments/dividends/summary', () => {
  beforeEach(async () => {
    const res = await request(app).post('/api/v1/investments').set(...auth()).send(validHolding());
    const id  = res.body.data.investment._id;
    await request(app).post(`/api/v1/investments/${id}/dividends`).set(...auth())
      .send({ amount: 50, date: new Date().toISOString(), type: 'cash' });
  });

  it('should return dividend summary with totalAllTime and totalYTD', async () => {
    const res = await request(app)
      .get('/api/v1/investments/dividends/summary')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.totalAllTime).toBeCloseTo(50, 2);
    expect(res.body.data.totalYTD).toBeCloseTo(50, 2);
    expect(res.body.data.byHolding.length).toBe(1);
    expect(res.body.data.byHolding[0].symbol).toBe('AAPL');
  });
});

// ── GET /api/v1/investments/dividends/history ────────────────────────────────

describe('GET /api/v1/investments/dividends/history', () => {
  beforeEach(async () => {
    const res = await request(app).post('/api/v1/investments').set(...auth()).send(validHolding());
    const id  = res.body.data.investment._id;
    await request(app).post(`/api/v1/investments/${id}/dividends`).set(...auth())
      .send({ amount: 25, date: '2024-03-15', type: 'cash' });
    await request(app).post(`/api/v1/investments/${id}/dividends`).set(...auth())
      .send({ amount: 25, date: '2024-09-15', type: 'cash' });
  });

  it('should return flat dividend history sorted newest-first', async () => {
    const res = await request(app)
      .get('/api/v1/investments/dividends/history')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.events.length).toBe(2);
    expect(res.body.data.total).toBe(2);
    // Newest first
    expect(new Date(res.body.data.events[0].date).getTime())
      .toBeGreaterThan(new Date(res.body.data.events[1].date).getTime());
  });
});

// ── GET /api/v1/reports/spending ──────────────────────────────────────────────

describe('GET /api/v1/reports/spending', () => {
  beforeEach(async () => {
    const start = new Date('2024-01-01');
    await Transaction.insertMany([
      { userId, accountId, amount: 120, type: 'debit', date: new Date('2024-03-10'), description: 'Grocery run',  category: 'Groceries',   categorySource: 'auto', deletedAt: null, isDuplicate: false },
      { userId, accountId, amount:  80, type: 'debit', date: new Date('2024-03-20'), description: 'Dinner',       category: 'Dining',       categorySource: 'auto', deletedAt: null, isDuplicate: false },
      { userId, accountId, amount:  50, type: 'debit', date: new Date('2024-04-05'), description: 'Bus pass',     category: 'Transport',    categorySource: 'auto', deletedAt: null, isDuplicate: false },
    ]);
  });

  it('should return spending breakdown for a date range', async () => {
    const res = await request(app)
      .get('/api/v1/reports/spending?startDate=2024-01-01&endDate=2024-12-31')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.grandTotal).toBeCloseTo(250, 2);
    expect(res.body.data.categories.length).toBe(3);
    // Groceries is the largest
    expect(res.body.data.categories[0].category).toBe('Groceries');
    expect(res.body.data.categories[0].total).toBeCloseTo(120, 2);
  });

  it('should return 422 when endDate is before startDate', async () => {
    const res = await request(app)
      .get('/api/v1/reports/spending?startDate=2024-06-01&endDate=2024-01-01')
      .set(...auth());

    expect(res.status).toBe(422);
  });
});

// ── GET /api/v1/reports/income ────────────────────────────────────────────────

describe('GET /api/v1/reports/income', () => {
  beforeEach(async () => {
    await Transaction.insertMany([
      { userId, accountId, amount: -3000, type: 'credit', date: new Date('2024-03-01'), description: 'Salary',    category: 'Income', categorySource: 'auto', deletedAt: null, isDuplicate: false },
      { userId, accountId, amount:  -200, type: 'refund', date: new Date('2024-03-15'), description: 'Refund',    category: 'Refunds', categorySource: 'auto', deletedAt: null, isDuplicate: false },
    ]);
  });

  it('should return income breakdown using abs of credit amounts', async () => {
    const res = await request(app)
      .get('/api/v1/reports/income?startDate=2024-01-01&endDate=2024-12-31')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data.grandTotal).toBeCloseTo(3200, 2);
    expect(res.body.data.categories.length).toBe(2);
  });
});

// ── GET /api/v1/reports/net-worth ────────────────────────────────────────────

describe('GET /api/v1/reports/net-worth', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/investments').set(...auth()).send({
      ...validHolding(), quantity: 10, averageCostBasis: 150, currentPrice: 180,
    });
  });

  it('should return net-worth snapshot combining bank + investments', async () => {
    const res = await request(app)
      .get('/api/v1/reports/net-worth')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalBankBalance');
    expect(res.body.data).toHaveProperty('totalInvestmentValue');
    expect(res.body.data).toHaveProperty('estimatedNetWorth');
    // account balance = 50000, investment value = 1800 → net worth = 51800
    expect(res.body.data.estimatedNetWorth).toBeCloseTo(51800, 2);
  });
});

// ── GET /api/v1/reports/charts/* ──────────────────────────────────────────────

describe('Report chart endpoints', () => {
  beforeEach(async () => {
    const now = new Date();
    await Transaction.insertMany([
      { userId, accountId, amount: 200, type: 'debit',  date: now, description: 'Spend A', category: 'Groceries', categorySource: 'auto', deletedAt: null, isDuplicate: false },
      { userId, accountId, amount: -1500, type: 'credit', date: now, description: 'Salary', category: 'Income',    categorySource: 'auto', deletedAt: null, isDuplicate: false },
    ]);
  });

  it('GET /charts/spending-trend should return monthly spending series', async () => {
    const res = await request(app)
      .get('/api/v1/reports/charts/spending-trend?months=3')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('month');
      expect(res.body.data[0]).toHaveProperty('total');
    }
  });

  it('GET /charts/categories should return category breakdown', async () => {
    const startDate = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const endDate   = new Date().toISOString();

    const res = await request(app)
      .get(`/api/v1/reports/charts/categories?startDate=${startDate}&endDate=${endDate}`)
      .set(...auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /charts/income-vs-expense should return monthly income and expense', async () => {
    const res = await request(app)
      .get('/api/v1/reports/charts/income-vs-expense?months=3')
      .set(...auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('month');
      expect(res.body.data[0]).toHaveProperty('income');
      expect(res.body.data[0]).toHaveProperty('expenses');
      expect(res.body.data[0]).toHaveProperty('net');
    }
  });

  it('GET /charts/spending-trend should reject months > 24', async () => {
    const res = await request(app)
      .get('/api/v1/reports/charts/spending-trend?months=25')
      .set(...auth());

    expect(res.status).toBe(422);
  });
});
