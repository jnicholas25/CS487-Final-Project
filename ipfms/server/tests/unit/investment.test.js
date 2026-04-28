/**
 * Unit tests — Investment Tracker (Step 7)
 *
 * Tests calculateHoldingReturn in pure isolation (no DB, no network).
 *
 * Scenarios covered:
 *   - Normal gain (price above cost basis)
 *   - Normal loss (price below cost basis)
 *   - Dividend-only return (no current price)
 *   - Total return including dividends
 *   - Annualized return (CAGR) when purchaseDate is set
 *   - Zero cost basis guard
 *   - Zero quantity
 *   - Holding with no dividends
 */

process.env.NODE_ENV          = 'test';
process.env.JWT_SECRET        = 'test_secret_long_enough_to_pass_validation_check';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_long_enough_12345678';

const { calculateHoldingReturn } = require('../../src/services/investments/performanceCalculator');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a lightweight holding-like object for testing.
 * (No Mongoose, so virtuals are not available — pass raw fields.)
 */
function makeHolding(overrides = {}) {
  return {
    quantity:          10,
    averageCostBasis:  100,   // $1,000 total cost
    currentPrice:      120,   // $1,200 current value  → +$200
    dividends:         [],
    purchaseDate:      null,
    ...overrides,
  };
}

// ── calculateHoldingReturn ────────────────────────────────────────────────────

describe('calculateHoldingReturn', () => {

  // ── Basic gain ──────────────────────────────────────────────────────────────

  it('should return positive totalReturn when current price exceeds cost basis', () => {
    const h = makeHolding({ quantity: 10, averageCostBasis: 100, currentPrice: 150 });
    // cost = 1000, value = 1500, gain = 500
    const r = calculateHoldingReturn(h);
    expect(r.totalReturn).toBeCloseTo(500, 2);
    expect(r.totalReturnPct).toBeCloseTo(50, 2);
  });

  // ── Basic loss ──────────────────────────────────────────────────────────────

  it('should return negative totalReturn when current price is below cost basis', () => {
    const h = makeHolding({ quantity: 10, averageCostBasis: 100, currentPrice: 80 });
    // cost = 1000, value = 800, loss = -200
    const r = calculateHoldingReturn(h);
    expect(r.totalReturn).toBeCloseTo(-200, 2);
    expect(r.totalReturnPct).toBeCloseTo(-20, 2);
  });

  // ── Break even ──────────────────────────────────────────────────────────────

  it('should return 0 gain when current price equals cost basis', () => {
    const h = makeHolding({ quantity: 5, averageCostBasis: 200, currentPrice: 200 });
    const r = calculateHoldingReturn(h);
    expect(r.totalReturn).toBe(0);
    expect(r.totalReturnPct).toBe(0);
  });

  // ── Dividends included in total return ─────────────────────────────────────

  it('should include dividend income in totalReturn', () => {
    const h = makeHolding({
      quantity:         10,
      averageCostBasis: 100,  // cost = 1000
      currentPrice:     100,  // no price gain
      dividends:        [
        { amount: 30, date: new Date('2024-06-01'), type: 'cash' },
        { amount: 20, date: new Date('2024-12-01'), type: 'cash' },
      ],
    });
    // gain = 0, dividends = 50 → total = 50
    const r = calculateHoldingReturn(h);
    expect(r.totalReturn).toBeCloseTo(50, 2);
    expect(r.totalReturnPct).toBeCloseTo(5, 2);
  });

  // ── Dividend-only return (no current price) ─────────────────────────────────

  it('should return dividend-only metrics when currentPrice is null', () => {
    const h = makeHolding({
      currentPrice: null,
      dividends:    [{ amount: 40, date: new Date(), type: 'cash' }],
    });
    // cost = 1000, dividends = 40 → totalReturn = 40, pct = 4%
    const r = calculateHoldingReturn(h);
    expect(r.totalReturn).toBeCloseTo(40, 2);
    expect(r.totalReturnPct).toBeCloseTo(4, 2);
    expect(r.annualizedReturnPct).toBeNull();
  });

  // ── Zero cost basis guard ───────────────────────────────────────────────────

  it('should return nulls when costBasis is 0', () => {
    const h = makeHolding({ quantity: 10, averageCostBasis: 0, currentPrice: 50 });
    const r = calculateHoldingReturn(h);
    expect(r.totalReturn).toBeNull();
    expect(r.totalReturnPct).toBeNull();
    expect(r.annualizedReturnPct).toBeNull();
  });

  // ── Annualized return (CAGR) ────────────────────────────────────────────────

  it('should compute annualizedReturnPct when purchaseDate is set and price is available', () => {
    // Buy 1 share at $100 exactly 2 years ago; now worth $121 → CAGR = 10%
    const twoYearsAgo = new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000);
    const h = makeHolding({
      quantity:         1,
      averageCostBasis: 100,
      currentPrice:     121,
      dividends:        [],
      purchaseDate:     twoYearsAgo,
    });
    const r = calculateHoldingReturn(h);
    // CAGR ≈ 10% — allow ±1% tolerance for date imprecision
    expect(r.annualizedReturnPct).not.toBeNull();
    expect(r.annualizedReturnPct).toBeGreaterThan(9);
    expect(r.annualizedReturnPct).toBeLessThan(11);
  });

  it('should return annualizedReturnPct=null when purchaseDate is null', () => {
    const h = makeHolding({ currentPrice: 200, purchaseDate: null });
    const r = calculateHoldingReturn(h);
    expect(r.annualizedReturnPct).toBeNull();
  });

  // ── Fractional quantities ───────────────────────────────────────────────────

  it('should handle fractional share quantities correctly', () => {
    // 0.5 shares, cost $50 each = $25 total cost; price now $60 → +$5 gain
    const h = makeHolding({ quantity: 0.5, averageCostBasis: 50, currentPrice: 60 });
    const r = calculateHoldingReturn(h);
    expect(r.totalReturn).toBeCloseTo(5, 2);
    expect(r.totalReturnPct).toBeCloseTo(20, 2);
  });
});
