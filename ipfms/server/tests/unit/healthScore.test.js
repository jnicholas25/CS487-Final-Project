'use strict';
/**
 * Unit tests for Algorithm 5.6 — Financial Health Score Calculator
 *
 * All MongoDB model calls are mocked so no real database is needed.
 */

jest.mock('../../src/models/Transaction');
jest.mock('../../src/models/Budget');
jest.mock('../../src/models/ScheduledPayment');
jest.mock('../../src/models/Account');

const mongoose       = require('mongoose');
const Transaction    = require('../../src/models/Transaction');
const Budget         = require('../../src/models/Budget');
const ScheduledPayment = require('../../src/models/ScheduledPayment');
const Account        = require('../../src/models/Account');

const { calculateHealthScore, WEIGHTS, scoreBand } = require('../../src/services/health-score/healthScoreCalculator');

// ── Helpers ───────────────────────────────────────────────────────────────────

const uid = new mongoose.Types.ObjectId();

/** Build a mock aggregate chain that returns the provided rows */
function mockAggregate(rows) {
  Transaction.aggregate = jest.fn().mockResolvedValue(rows);
}

/** Budget.find().lean() chain */
function mockBudgetFind(budgets) {
  Budget.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(budgets) });
}

/** ScheduledPayment.find().lean() chain */
function mockPaymentFind(payments) {
  ScheduledPayment.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(payments) });
}

/** Account.find().lean() chain */
function mockAccountFind(accounts) {
  Account.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(accounts) });
}

// ── scoreBand ─────────────────────────────────────────────────────────────────

describe('scoreBand()', () => {
  test('≥ 80 → Excellent', () => expect(scoreBand(82)).toBe('Excellent'));
  test('65–79 → Good',     () => expect(scoreBand(70)).toBe('Good'));
  test('50–64 → Fair',     () => expect(scoreBand(55)).toBe('Fair'));
  test('35–49 → Needs Work',() => expect(scoreBand(40)).toBe('Needs Work'));
  test('< 35 → Poor',      () => expect(scoreBand(20)).toBe('Poor'));
  test('exactly 80 → Excellent', () => expect(scoreBand(80)).toBe('Excellent'));
  test('exactly 65 → Good',      () => expect(scoreBand(65)).toBe('Good'));
});

// ── WEIGHTS sum to 1 ──────────────────────────────────────────────────────────

describe('WEIGHTS', () => {
  test('all weights sum to 1.00', () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});

// ── calculateHealthScore ──────────────────────────────────────────────────────

describe('calculateHealthScore()', () => {
  beforeEach(() => jest.clearAllMocks());

  // -- Ideal user: high savings, perfect budgets, perfect payments, no debt, 6-month emergency fund
  test('returns Excellent score for an ideal financial profile', async () => {
    // Savings: income $5000, expenses $2000 → 60% savings rate → score 100
    mockAggregate([{ _id: null, income: 5000, expenses: 2000 }]);

    mockBudgetFind([{
      categories: [
        { limit: 500, spent: 300 }, // 60% used
        { limit: 800, spent: 400 }, // 50% used
      ],
    }]);

    // Payment history: 10/10 successful
    mockPaymentFind([{
      executionHistory: Array.from({ length: 10 }, (_, i) => ({
        attemptedAt: new Date(Date.now() - i * 86400000),
        status: 'success',
      })),
    }]);

    // Accounts: no debt + $12,000 savings (> 3 × $2000 avg monthly expense)
    Account.find = jest.fn()
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue([  // debt query
        { balance: 5000, accountType: 'checking' },
        { balance: 8000, accountType: 'savings'  },
      ])})
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue([  // emergency fund query
        { balance: 5000, accountType: 'checking' },
        { balance: 8000, accountType: 'savings'  },
      ])});

    const result = await calculateHealthScore(uid);

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.label).toBe('Excellent');
    expect(result.components).toHaveLength(5);
    expect(result.advice).toBeInstanceOf(Array);
    expect(result.computedAt).toBeInstanceOf(Date);
  });

  // -- Zero income → savings component returns 0
  test('returns score of 0 for savings component when income is zero', async () => {
    mockAggregate([]);  // empty aggregate → no income

    mockBudgetFind([]);
    mockPaymentFind([]);
    Account.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const result = await calculateHealthScore(uid);

    const savingsComp = result.components.find((c) => c.key === 'savingsRate');
    expect(savingsComp.score).toBe(0);
  });

  // -- All budgets busted → budgetAdherence = 0
  test('budget adherence score is 0 when all categories are over limit', async () => {
    mockAggregate([{ _id: null, income: 3000, expenses: 2000 }]);

    mockBudgetFind([{
      categories: [
        { limit: 200, spent: 500 }, // over
        { limit: 100, spent: 300 }, // over
      ],
    }]);

    mockPaymentFind([]);
    Account.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const result = await calculateHealthScore(uid);
    const budgetComp = result.components.find((c) => c.key === 'budgetAdherence');
    expect(budgetComp.score).toBe(0);
  });

  // -- No budgets → neutral score 60
  test('budget adherence returns neutral score 60 when no budgets exist', async () => {
    mockAggregate([{ _id: null, income: 3000, expenses: 2000 }]);
    mockBudgetFind([]);
    mockPaymentFind([]);
    Account.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const result = await calculateHealthScore(uid);
    const budgetComp = result.components.find((c) => c.key === 'budgetAdherence');
    expect(budgetComp.score).toBe(60);
  });

  // -- No payment history → neutral score 70
  test('payment history returns neutral score 70 when no history exists', async () => {
    mockAggregate([{ _id: null, income: 2000, expenses: 1500 }]);
    mockBudgetFind([]);
    mockPaymentFind([]);
    Account.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const result = await calculateHealthScore(uid);
    const payComp = result.components.find((c) => c.key === 'paymentHistory');
    expect(payComp.score).toBe(70);
  });

  // -- DTI 0 → debtToIncome score = 100
  test('debtToIncome score is 100 when there is no debt', async () => {
    mockAggregate([{ _id: null, income: 4000, expenses: 2000 }]);
    mockBudgetFind([]);
    mockPaymentFind([]);
    // All positive balances — no debt
    Account.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { balance: 10000, accountType: 'savings' },
    ])});

    const result = await calculateHealthScore(uid);
    const dtiComp = result.components.find((c) => c.key === 'debtToIncome');
    expect(dtiComp.score).toBe(100);
  });

  // -- Score is always 0–100
  test('composite score is always between 0 and 100', async () => {
    // Very bad profile: no income, all over budget, all payments failed
    mockAggregate([{ _id: null, income: 0, expenses: 5000 }]);
    mockBudgetFind([{ categories: [{ limit: 100, spent: 9999 }] }]);
    mockPaymentFind([{ executionHistory: [
      { attemptedAt: new Date(), status: 'failed' },
      { attemptedAt: new Date(), status: 'failed' },
    ]}]);
    Account.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { balance: -50000, accountType: 'checking' },
    ])});

    const result = await calculateHealthScore(uid);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  // -- Result shape is complete
  test('result includes all required fields', async () => {
    mockAggregate([{ _id: null, income: 3000, expenses: 1800 }]);
    mockBudgetFind([]);
    mockPaymentFind([]);
    Account.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const result = await calculateHealthScore(uid);

    expect(result).toMatchObject({
      score:      expect.any(Number),
      label:      expect.any(String),
      components: expect.any(Array),
      advice:     expect.any(Array),
      computedAt: expect.any(Date),
    });
    expect(result.components.map((c) => c.key)).toEqual(
      expect.arrayContaining(['savingsRate', 'budgetAdherence', 'paymentHistory', 'debtToIncome', 'emergencyFund']),
    );
  });

  // -- Advice array is not empty
  test('advice array always has at least one item', async () => {
    mockAggregate([{ _id: null, income: 2000, expenses: 1800 }]);
    mockBudgetFind([]);
    mockPaymentFind([]);
    Account.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const { advice } = await calculateHealthScore(uid);
    expect(advice.length).toBeGreaterThanOrEqual(1);
  });
});
