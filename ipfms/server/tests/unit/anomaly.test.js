/**
 * Unit tests — Anomaly Detection Engine (Step 5)
 *
 * Tests computeZScore in pure isolation:
 *   - Normal computation (mean, stdDev, zScore)
 *   - Insufficient sample handling (reliable = false)
 *   - Zero stdDev edge case (all amounts identical → zScore = null)
 *   - Sample size cap (only last N records used)
 *
 * The Transaction model is mocked so no DB or network is needed.
 */

process.env.NODE_ENV          = 'test';
process.env.JWT_SECRET        = 'test_secret_long_enough_to_pass_validation_check';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_long_enough_12345678';

// ── Mock Transaction.find ─────────────────────────────────────────────────────

// We intercept the Transaction model before the module under test loads it
jest.mock('../../src/models/Transaction', () => {
  const mockFind = jest.fn();
  return { find: mockFind };
});

const Transaction          = require('../../src/models/Transaction');
const { computeZScore }    = require('../../src/services/anomaly/zScoreDetector');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a chainable mock for Transaction.find(...).sort(...).limit(...).select(...).lean()
 * that ultimately resolves with `docs`.
 */
function mockHistory(amounts) {
  const docs = amounts.map((amount) => ({ amount }));
  const chain = {
    sort:   jest.fn().mockReturnThis(),
    limit:  jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean:   jest.fn().mockResolvedValue(docs),
  };
  Transaction.find.mockReturnValue(chain);
  return chain;
}

// ── computeZScore ─────────────────────────────────────────────────────────────

describe('computeZScore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── No history ──────────────────────────────────────────────────────────────

  it('should return zScore=null and reliable=false when there is no history', async () => {
    mockHistory([]);

    const result = await computeZScore('u1', 'Dining', 50);

    expect(result.zScore).toBeNull();
    expect(result.mean).toBeNull();
    expect(result.stdDev).toBeNull();
    expect(result.sampleSize).toBe(0);
    expect(result.reliable).toBe(false);
  });

  // ── Insufficient samples ────────────────────────────────────────────────────

  it('should mark reliable=false when fewer than 5 samples exist', async () => {
    mockHistory([10, 20, 30]); // 3 samples

    const result = await computeZScore('u1', 'Dining', 50);

    expect(result.sampleSize).toBe(3);
    expect(result.reliable).toBe(false);
    // zScore should still be computed (we have > 0 samples)
    expect(result.zScore).not.toBeNull();
  });

  it('should mark reliable=true when exactly 5 samples exist', async () => {
    mockHistory([10, 20, 30, 40, 50]); // 5 samples

    const result = await computeZScore('u1', 'Dining', 30);

    expect(result.sampleSize).toBe(5);
    expect(result.reliable).toBe(true);
  });

  // ── Z-score computation ─────────────────────────────────────────────────────

  it('should compute correct mean, stdDev, and zScore for a known dataset', async () => {
    // History: [10, 20, 30, 40, 50]
    // mean = 30, variance = ((400+100+0+100+400)/5) = 200, stdDev = √200 ≈ 14.142
    // z for amount=30 → (30-30)/14.142 = 0
    mockHistory([10, 20, 30, 40, 50]);

    const result = await computeZScore('u1', 'Dining', 30);

    expect(result.mean).toBeCloseTo(30, 5);
    expect(result.stdDev).toBeCloseTo(Math.sqrt(200), 5);
    expect(result.zScore).toBeCloseTo(0, 5);
  });

  it('should return a positive zScore for an amount above the mean', async () => {
    // mean=20, stdDev=0 won't happen here; let's use [10, 20, 30] (mean=20, σ≈8.165)
    mockHistory([10, 20, 30]);

    const result = await computeZScore('u1', 'Groceries', 50);

    expect(result.zScore).toBeGreaterThan(0);
  });

  it('should return a negative zScore for an amount below the mean', async () => {
    mockHistory([10, 20, 30]);

    const result = await computeZScore('u1', 'Groceries', 1);

    expect(result.zScore).toBeLessThan(0);
  });

  it('should return a high absolute zScore for an extreme outlier', async () => {
    // mean=20, stdDev≈8.165; amount=100 → z = (100-20)/8.165 ≈ 9.8
    mockHistory([10, 20, 30, 15, 25]);

    const result = await computeZScore('u1', 'Entertainment', 100);

    expect(result.reliable).toBe(true);
    expect(Math.abs(result.zScore)).toBeGreaterThan(3.5);
  });

  // ── Zero stdDev edge case ───────────────────────────────────────────────────

  it('should return zScore=null when all historical amounts are identical (stdDev=0)', async () => {
    // All transactions cost exactly $20
    mockHistory([20, 20, 20, 20, 20]);

    const result = await computeZScore('u1', 'Subscriptions', 50);

    expect(result.stdDev).toBeCloseTo(0, 5);
    expect(result.zScore).toBeNull();
    expect(result.mean).toBeCloseTo(20, 5);
    expect(result.reliable).toBe(true);
  });

  // ── Sample size parameter ───────────────────────────────────────────────────

  it('should pass the sampleSize argument to the DB query via .limit()', async () => {
    const chain = mockHistory([10, 20, 30, 40, 50]);

    await computeZScore('u1', 'Dining', 30, 10);

    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('should default to sampleSize=30 when not provided', async () => {
    const chain = mockHistory([10, 20, 30, 40, 50]);

    await computeZScore('u1', 'Dining', 30);

    expect(chain.limit).toHaveBeenCalledWith(30);
  });

  // ── Query filters ───────────────────────────────────────────────────────────

  it('should filter by userId, category, type=debit, and deletedAt=null', async () => {
    mockHistory([10, 20]);

    await computeZScore('myUserId', 'Groceries', 15);

    expect(Transaction.find).toHaveBeenCalledWith(
      expect.objectContaining({
        userId:      'myUserId',
        category:    'Groceries',
        type:        'debit',
        deletedAt:   null,
        isDuplicate: false,
      })
    );
  });
});
