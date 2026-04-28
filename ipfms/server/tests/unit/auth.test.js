/**
 * Unit tests — Authentication Services
 * Tests tokenService, lockoutService, and twoFactorService in isolation.
 * No database required.
 */

const jwt = require('jsonwebtoken');

// Set env vars before importing modules
process.env.JWT_SECRET = 'test_access_secret_long_enough_to_be_valid_12345';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_long_enough_to_be_valid_123';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI_TEST = 'mongodb://localhost:27017/ipfms_test';

const tokenService = require('../../src/services/auth/tokenService');

// ── tokenService ─────────────────────────────────────────────────────────────

describe('tokenService', () => {
  const payload = { userId: '507f1f77bcf86cd799439011', email: 'user@test.com', role: 'user' };

  describe('generateAccessToken', () => {
    it('should return a signed JWT string', () => {
      const token = tokenService.generateAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should encode the correct subject and role', () => {
      const token = tokenService.generateAccessToken(payload);
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.type).toBe('access');
    });
  });

  describe('generateRefreshToken', () => {
    it('should return a signed JWT string with type=refresh', () => {
      const token = tokenService.generateRefreshToken(payload);
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe(payload.userId);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('verifyAccessToken', () => {
    it('should successfully verify a valid access token', () => {
      const token = tokenService.generateAccessToken(payload);
      const decoded = tokenService.verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.userId);
    });

    it('should throw on an invalid token', () => {
      expect(() => tokenService.verifyAccessToken('not.a.token')).toThrow();
    });

    it('should throw if a refresh token is passed to verifyAccessToken', () => {
      const refresh = tokenService.generateRefreshToken(payload);
      expect(() => tokenService.verifyAccessToken(refresh)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should successfully verify a valid refresh token', () => {
      const token = tokenService.generateRefreshToken(payload);
      const decoded = tokenService.verifyRefreshToken(token);
      expect(decoded.sub).toBe(payload.userId);
    });

    it('should throw if an access token is passed to verifyRefreshToken', () => {
      const access = tokenService.generateAccessToken(payload);
      expect(() => tokenService.verifyRefreshToken(access)).toThrow();
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from Bearer header', () => {
      const token = 'abc.def.ghi';
      expect(tokenService.extractBearerToken(`Bearer ${token}`)).toBe(token);
    });

    it('should return null for missing header', () => {
      expect(tokenService.extractBearerToken(undefined)).toBeNull();
    });

    it('should return null for non-Bearer header', () => {
      expect(tokenService.extractBearerToken('Basic abc')).toBeNull();
    });
  });

  describe('generateTokenPair', () => {
    it('should return accessToken, refreshToken, and expiresIn', () => {
      const pair = tokenService.generateTokenPair(payload);
      expect(pair).toHaveProperty('accessToken');
      expect(pair).toHaveProperty('refreshToken');
      expect(pair).toHaveProperty('expiresIn');
    });
  });
});

// ── twoFactorService ─────────────────────────────────────────────────────────

describe('twoFactorService', () => {
  const twoFactorService = require('../../src/services/auth/twoFactorService');

  describe('generateSecret', () => {
    it('should return a secret, QR code data URL, and otpauth URL', async () => {
      const result = await twoFactorService.generateSecret('test@example.com');
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCodeDataUrl');
      expect(result).toHaveProperty('otpauthUrl');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    });
  });

  describe('verifyToken', () => {
    it('should return false for an invalid TOTP code', async () => {
      const { secret } = await twoFactorService.generateSecret('test@example.com');
      const result = twoFactorService.verifyToken(secret, '000000');
      expect(result).toBe(false);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 8 backup codes', async () => {
      const { plainCodes, hashedCodes } = await twoFactorService.generateBackupCodes();
      expect(plainCodes).toHaveLength(8);
      expect(hashedCodes).toHaveLength(8);
    });

    it('each plain code should be 10 uppercase alphanumeric characters', async () => {
      const { plainCodes } = await twoFactorService.generateBackupCodes();
      plainCodes.forEach((code) => {
        expect(code).toMatch(/^[A-F0-9]{10}$/);
      });
    });
  });
});
