/**
 * Integration tests — Authentication Flow
 * Uses supertest + mongodb-memory-server so no real DB is needed.
 * Tests the full HTTP layer: routes → controller → service → model.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

// Set env before importing app
process.env.JWT_SECRET = 'test_access_secret_long_enough_to_be_valid_12345';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_long_enough_to_be_valid_123';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.AUTH_RATE_LIMIT_MAX = '1000';

const app = require('../../app');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clean up users between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ── Test data helpers ─────────────────────────────────────────────────────────

const validUser = {
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  password: 'TestPass1!',
};

async function registerUser(overrides = {}) {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ ...validUser, ...overrides });
}

async function loginUser(credentials = {}) {
  return request(app)
    .post('/api/v1/auth/login')
    .send({ email: validUser.email, password: validUser.password, ...credentials });
}

// ── Registration ──────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('should register a new user and return tokens', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('tokens');
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.tokens).toHaveProperty('refreshToken');
    expect(res.body.data.user.email).toBe(validUser.email);
    // Sensitive fields must NOT be returned
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('should reject duplicate email with 409', async () => {
    await registerUser();
    const res = await registerUser();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('should reject a weak password with 422', async () => {
    const res = await registerUser({ password: 'weak' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing required fields with 422', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'a@b.com' });
    expect(res.status).toBe(422);
  });

  it('should reject an invalid email with 422', async () => {
    const res = await registerUser({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await registerUser();
  });

  it('should login and return tokens', async () => {
    const res = await loginUser();
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(validUser.email);
  });

  it('should reject wrong password with 401', async () => {
    const res = await loginUser({ password: 'WrongPassword1!' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('should reject unknown email with 401', async () => {
    const res = await loginUser({ email: 'nobody@nowhere.com' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('should lock account after 5 failed attempts', async () => {
    for (let i = 0; i < 4; i++) {
      await loginUser({ password: 'WrongPass1!' });
    }
    const res = await loginUser({ password: 'WrongPass1!' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ACCOUNT_LOCKED');
  });
});

// ── Token refresh ─────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  it('should return a new token pair for a valid refresh token', async () => {
    await registerUser();
    const loginRes = await loginUser();
    const { refreshToken } = loginRes.body.data.tokens;

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
  });

  it('should reject an invalid refresh token with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'invalid.token.here' });
    expect(res.status).toBe(401);
  });
});

// ── Protected route — GET /me ─────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('should return the authenticated user', async () => {
    await registerUser();
    const loginRes = await loginUser();
    const { accessToken } = loginRes.body.data.tokens;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(validUser.email);
  });

  it('should reject requests without a token with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('should reject requests with a malformed token with 401', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer bad.token.here');
    expect(res.status).toBe(401);
  });
});

// ── Change password ───────────────────────────────────────────────────────────

describe('PATCH /api/v1/auth/password', () => {
  let accessToken;

  beforeEach(async () => {
    await registerUser();
    const loginRes = await loginUser();
    accessToken = loginRes.body.data.tokens.accessToken;
  });

  it('should change the password with correct credentials', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: validUser.password,
        newPassword: 'NewPass99!',
        confirmPassword: 'NewPass99!',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Should now be able to login with the new password
    const loginRes = await loginUser({ password: 'NewPass99!' });
    expect(loginRes.status).toBe(200);
  });

  it('should reject wrong current password with 401', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'WrongOld1!',
        newPassword: 'NewPass99!',
        confirmPassword: 'NewPass99!',
      });
    expect(res.status).toBe(401);
  });

  it('should reject mismatched confirmation passwords', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: validUser.password,
        newPassword: 'NewPass99!',
        confirmPassword: 'DifferentPass99!',
      });
    expect(res.status).toBe(422);
  });
});
