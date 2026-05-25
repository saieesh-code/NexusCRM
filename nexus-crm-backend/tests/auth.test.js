/**
 * Auth API Tests
 * Run: npm test
 */

'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');

// Use separate test DB
beforeAll(async () => {
  const uri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/nexus_crm_test';
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

beforeEach(async () => {
  await User.deleteMany({});
});

const API = '/api/v1';

const testUser = {
  name: 'Test Admin',
  email: 'testadmin@nexuscrm.io',
  password: 'Admin@1234!',
};

describe('POST /auth/register', () => {
  it('registers a new user and returns tokens', async () => {
    const res = await request(app).post(`${API}/auth/register`).send(testUser);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.password).toBeUndefined(); // Never exposed
  });

  it('rejects duplicate email', async () => {
    await request(app).post(`${API}/auth/register`).send(testUser);
    const res = await request(app).post(`${API}/auth/register`).send(testUser);
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post(`${API}/auth/register`)
      .send({ ...testUser, email: 'not-an-email' });
    expect(res.statusCode).toBe(422);
  });

  it('rejects weak password', async () => {
    const res = await request(app)
      .post(`${API}/auth/register`)
      .send({ ...testUser, password: '12345678' });
    expect(res.statusCode).toBe(422);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post(`${API}/auth/register`).send(testUser);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: testUser.email, password: testUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: testUser.email, password: 'WrongPass@1' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects non-existent email', async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: 'ghost@nowhere.com', password: testUser.password });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /auth/profile', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post(`${API}/auth/register`).send(testUser);
    token = res.body.accessToken;
  });

  it('returns profile with valid token', async () => {
    const res = await request(app)
      .get(`${API}/auth/profile`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get(`${API}/auth/profile`);
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get(`${API}/auth/profile`)
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('clears cookies and returns success', async () => {
    const res = await request(app).post(`${API}/auth/logout`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
