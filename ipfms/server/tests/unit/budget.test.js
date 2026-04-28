/**
 * Unit tests — Budget Services
 * Tests budgetMonitor.checkAndTriggerAlerts and savingsRecommender.getSavingsScore
 * in pure isolation (no DB).
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_long_enough_to_pass_validation_check';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_long_enough_12345678';

const { checkAndTriggerAlerts } = require('../../src/services/budgets/budgetMonitor');
const { getSavingsScore }        = require('../../src/services/budgets/savingsRecommender');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBudget(categoryOverrides = []) {
  return {
    _id: 'budget123',
    userId: 'user123',
    name: 'Test Budget',
    categories: categoryOverrides,
  };
}

function makeCategory(category, limit, spent, alertThreshold = 80) {
  return { category, limit, spent, alertThreshold };
}

// ── checkAndTriggerAlerts ─────────────────────────────────────────────────────

describe('checkAndTriggerAlerts', () => {
  it('should return no alerts when all categories are under threshold', () => {
    const budget = makeBudget([
      makeCategory('Food & Dining', 500, 200),
      makeCategory('Shopping', 200, 100),
    ]);
    const alerts = checkAndTriggerAlerts(budget);
    expect(alerts).toHaveLength(0);
  });

  it('should fire a warning alert when spending reaches the alertThreshold', () => {
    const budget = makeBudget([
      makeCategory('Food & Dining', 500, 410), // 82% — above 80% threshold
    ]);
    const alerts = checkAndTriggerAlerts(budget);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('warning');
    expect(alerts[0].category).toBe('Food & Dining');
    expect(alerts[0].percentUsed).toBe(82);
  });

  it('should fire a breach alert when spending reaches or exceeds 100%', () => {
    const budget = makeBudget([
      makeCategory('Shopping', 100, 110), // 110%
    ]);
    const alerts = checkAndTriggerAlerts(budget);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('breach');
    expect(alerts[0].overBy).toBeCloseTo(10);
  });

  it('should fire breach (not warning) when over 100%', () => {
    const budget = makeBudget([
      makeCategory('Entertainment', 200, 220),
    ]);
    const alerts = checkAndTriggerAlerts(budget);
    expect(alerts.every((a) => a.level === 'breach')).toBe(true);
  });

  it('should skip categories with a zero limit', () => {
    const budget = makeBudget([
      makeCategory('Travel', 0, 500),
    ]);
    const alerts = checkAndTriggerAlerts(budget);
    expect(alerts).toHaveLength(0);
  });

  it('should respect a custom alertThreshold', () => {
    const budget = makeBudget([
      makeCategory('Health & Fitness', 200, 170, 90), // 85% — below custom 90% threshold
    ]);
    expect(checkAndTriggerAlerts(budget)).toHaveLength(0);

    budget.categories[0].spent = 185; // 92.5% — above 90% threshold
    expect(checkAndTriggerAlerts(budget)).toHaveLength(1);
    expect(checkAndTriggerAlerts(budget)[0].level).toBe('warning');
  });

  it('should return alerts for multiple categories independently', () => {
    const budget = makeBudget([
      makeCategory('Food & Dining', 500, 450), // 90% → warning
      makeCategory('Shopping', 100, 105),      // 105% → breach
      makeCategory('Entertainment', 300, 100), // 33% → none
    ]);
    const alerts = checkAndTriggerAlerts(budget);
    expect(alerts).toHaveLength(2);
    const levels = alerts.map((a) => a.level).sort();
    expect(levels).toEqual(['breach', 'warning']);
  });

  it('should include userId, budgetId, and triggeredAt on each alert', () => {
    const budget = makeBudget([makeCategory('Groceries', 300, 280)]);
    const [alert] = checkAndTriggerAlerts(budget);
    expect(alert.userId).toBe('user123');
    expect(alert.budgetId).toBe('budget123');
    expect(alert.triggeredAt).toBeInstanceOf(Date);
  });
});

// ── getSavingsScore ───────────────────────────────────────────────────────────

describe('getSavingsScore', () => {
  it('should return 100 for an empty budget', () => {
    expect(getSavingsScore(makeBudget())).toBe(100);
  });

  it('should return 100 when all categories are under 70% spent', () => {
    const budget = makeBudget([
      makeCategory('Food & Dining', 500, 200), // 40%
      makeCategory('Shopping', 200, 100),       // 50%
    ]);
    expect(getSavingsScore(budget)).toBe(100);
  });

  it('should return a lower score when categories are near limit', () => {
    const budget = makeBudget([
      makeCategory('Food & Dining', 500, 450), // 90%
    ]);
    const score = getSavingsScore(budget);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it('should return a very low score when over budget', () => {
    const budget = makeBudget([
      makeCategory('Shopping', 100, 200), // 200%
    ]);
    const score = getSavingsScore(budget);
    expect(score).toBeLessThan(50);
  });

  it('should be weighted by category limit (higher limit = more impact)', () => {
    // Large category well under budget vs small category over budget
    const goodBudget = makeBudget([
      makeCategory('Housing', 2000, 800),    // 40% — large
      makeCategory('Entertainment', 50, 55), // 110% — tiny
    ]);
    const score = getSavingsScore(goodBudget);
    // Housing dominates — score should still be high
    expect(score).toBeGreaterThan(75);
  });

  it('should return 0 for extreme overspending across all categories', () => {
    const budget = makeBudget([
      makeCategory('Food & Dining', 100, 500), // 500%
      makeCategory('Shopping', 100, 400),       // 400%
    ]);
    const score = getSavingsScore(budget);
    expect(score).toBe(0);
  });
});
