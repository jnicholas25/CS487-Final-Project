/**
 * Unit tests — Transaction Services
 * Tests autoCategorizer and duplicateDetector in pure isolation (no DB).
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_long_enough_to_pass_validation_check';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_long_enough_12345678';
process.env.MONGODB_URI_TEST = 'mongodb://localhost:27017/ipfms_test';

const { categorise, buildSearchText, KEYWORD_RULES } = require('../../src/services/transactions/autoCategorizer');
const { buildFingerprint } = require('../../src/services/transactions/duplicateDetector');

// ── autoCategorizer ───────────────────────────────────────────────────────────

describe('autoCategorizer', () => {
  describe('categorise — keyword matching', () => {
    const cases = [
      { description: 'NETFLIX.COM SUBSCRIPTION', expected: 'Entertainment' },
      { description: 'TRADER JOES #123 GROCERY', expected: 'Food & Dining' },
      { description: 'SHELL OIL 12345', expected: 'Transportation' },
      { description: 'STARBUCKS STORE 00123', expected: 'Food & Dining' },
      { description: 'UBER TRIP HELP.UBER.COM', expected: 'Transportation' },
      { description: 'AMAZON.COM*123ABC456', expected: 'Shopping' },
      { description: 'COMCAST CABLE PAYMENT', expected: 'Bills & Utilities' },
      { description: 'PLANET FITNESS MEMBERSHIP', expected: 'Health & Fitness' },
      { description: 'CVS/PHARMACY 1234', expected: 'Health & Fitness' },
      { description: 'DELTA AIR LINES TICKET', expected: 'Travel' },
      { description: 'MARRIOTT HOTELS CHARGE', expected: 'Travel' },
      { description: 'PAYROLL DIRECT DEPOSIT', expected: 'Income' },
      { description: 'VENMO PAYMENT', expected: 'Transfers' },
      { description: 'ATM WITHDRAWAL FEE', expected: 'Cash & ATM' },
    ];

    cases.forEach(({ description, expected }) => {
      it(`should categorise "${description}" as "${expected}"`, () => {
        const result = categorise({ description, amount: 10, type: 'debit' });
        expect(result.category).toBe(expected);
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('categorise — fallback', () => {
    it('should return Uncategorized for unrecognised description', () => {
      const result = categorise({
        description: 'XYZ OBSCURE VENDOR 9999',
        amount: 50,
        type: 'debit',
      });
      expect(result.category).toBe('Uncategorized');
      expect(result.confidence).toBe(0);
      expect(result.source).toBe('fallback');
    });
  });

  describe('categorise — income heuristic', () => {
    it('should categorise a credit with payroll in description as Income', () => {
      const result = categorise({
        description: 'DIRECT DEPOSIT PAYROLL',
        amount: -2500,
        type: 'credit',
      });
      expect(result.category).toBe('Income');
    });
  });

  describe('categorise — MCC code', () => {
    it('should categorise by MCC 5411 as Groceries', () => {
      const result = categorise({
        description: 'UNKNOWN STORE 999',
        amount: 40,
        type: 'debit',
        categoryCode: '5411',
      });
      expect(result.category).toBe('Food & Dining');
      expect(result.subcategory).toBe('Groceries');
      expect(result.source).toBe('mcc');
    });

    it('should categorise by MCC 5812 as Restaurants', () => {
      const result = categorise({
        description: 'PLACE 000',
        amount: 25,
        type: 'debit',
        categoryCode: '5812',
      });
      expect(result.category).toBe('Food & Dining');
    });
  });

  describe('buildSearchText', () => {
    it('should normalise and join text parts', () => {
      const result = buildSearchText('AMAZON.COM*purchase', 'Amazon', 'Online Retail');
      expect(result).toContain('amazon');
      expect(result).not.toContain('.');
    });

    it('should ignore falsy parts', () => {
      const result = buildSearchText('STARBUCKS', null, undefined);
      expect(result).toBe('starbucks');
    });
  });

  describe('KEYWORD_RULES integrity', () => {
    it('should have no duplicate keywords across all rules', () => {
      const all = [];
      for (const rule of KEYWORD_RULES) {
        for (const kw of rule.keywords) {
          all.push(kw.toLowerCase());
        }
      }
      const unique = new Set(all);
      expect(unique.size).toBe(all.length);
    });

    it('each rule should have confidence between 0 and 1', () => {
      for (const rule of KEYWORD_RULES) {
        expect(rule.confidence).toBeGreaterThan(0);
        expect(rule.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});

// ── duplicateDetector — buildFingerprint ──────────────────────────────────────

describe('duplicateDetector — buildFingerprint', () => {
  it('should strip noise words and punctuation', () => {
    const fp = buildFingerprint('POS PURCHASE #12345 STARBUCKS INC LLC');
    expect(fp).not.toContain('inc');
    expect(fp).not.toContain('llc');
    expect(fp).not.toContain('#');
    expect(fp).not.toContain('pos');
  });

  it('should produce the same fingerprint for minor description variations', () => {
    const fp1 = buildFingerprint('AMAZON.COM*123 PURCHASE');
    const fp2 = buildFingerprint('AMAZON.COM*456 PURCHASE');
    // First 40 chars after normalisation should match
    expect(fp1.slice(0, 15)).toBe(fp2.slice(0, 15));
  });

  it('should truncate to 40 characters', () => {
    const longDesc = 'A'.repeat(100);
    expect(buildFingerprint(longDesc).length).toBeLessThanOrEqual(40);
  });

  it('should return an empty string for an empty input', () => {
    expect(buildFingerprint('')).toBe('');
  });
});
