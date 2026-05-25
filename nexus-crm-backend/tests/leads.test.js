/**
 * Leads API Tests
 * Run: npm test
 */

'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');

beforeAll(async () => {
  const uri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/nexus_crm_test';
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

let adminToken;
let repToken;
let adminUser;

beforeEach(async () => {
  await User.deleteMany({});
  await Lead.deleteMany({});

  // Register admin
  const adminRes = await request(app).post('/api/v1/auth/register').send({
    name: 'Admin',
    email: 'admin@test.com',
    password: 'Admin@1234!',
  });
  adminToken = adminRes.body.accessToken;
  adminUser = adminRes.body.user;

  // Promote to admin directly
  await User.findByIdAndUpdate(adminUser.id, { role: 'admin' });

  // Register sales rep
  const repRes = await request(app).post('/api/v1/auth/register').send({
    name: 'Rep User',
    email: 'rep@test.com',
    password: 'Admin@1234!',
  });
  repToken = repRes.body.accessToken;
});

const validLead = {
  fullName: 'Jane Smith',
  email: 'jane@acme.com',
  phone: '+1 555 000 1234',
  company: 'Acme Corp',
  source: 'Website',
  status: 'New',
  message: 'Interested in the pro plan.',
};

const API = '/api/v1';

describe('POST /leads', () => {
  it('creates a lead when authenticated', async () => {
    const res = await request(app)
      .post(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLead);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.fullName).toBe(validLead.fullName);
    expect(res.body.data.email).toBe(validLead.email);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post(`${API}/leads`).send(validLead);
    expect(res.statusCode).toBe(401);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ company: 'No Name Corp' });
    expect(res.statusCode).toBe(422);
  });

  it('rejects invalid status', async () => {
    const res = await request(app)
      .post(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validLead, status: 'InvalidStatus' });
    expect(res.statusCode).toBe(422);
  });
});

describe('GET /leads', () => {
  beforeEach(async () => {
    await request(app)
      .post(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLead);
    await request(app)
      .post(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validLead, fullName: 'Bob Jones', email: 'bob@corp.com', status: 'Converted' });
  });

  it('returns paginated leads list', async () => {
    const res = await request(app)
      .get(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBe(2);
  });

  it('filters by status', async () => {
    const res = await request(app)
      .get(`${API}/leads?status=Converted`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('Converted');
  });

  it('searches by name', async () => {
    const res = await request(app)
      .get(`${API}/leads?search=Jane`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].fullName).toContain('Jane');
  });

  it('respects pagination params', async () => {
    const res = await request(app)
      .get(`${API}/leads?page=1&limit=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.totalPages).toBe(2);
  });
});

describe('GET /leads/:id', () => {
  let leadId;

  beforeEach(async () => {
    const res = await request(app)
      .post(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLead);
    leadId = res.body.data._id;
  });

  it('returns a single lead', async () => {
    const res = await request(app)
      .get(`${API}/leads/${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data._id).toBe(leadId);
  });

  it('returns 404 for non-existent lead', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`${API}/leads/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for invalid ObjectId', async () => {
    const res = await request(app)
      .get(`${API}/leads/not-an-id`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(422);
  });
});

describe('PUT /leads/:id', () => {
  let leadId;

  beforeEach(async () => {
    const res = await request(app)
      .post(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLead);
    leadId = res.body.data._id;
  });

  it('updates a lead', async () => {
    const res = await request(app)
      .put(`${API}/leads/${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Contacted', company: 'Updated Corp' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('Contacted');
    expect(res.body.data.company).toBe('Updated Corp');
  });

  it('rejects invalid status on update', async () => {
    const res = await request(app)
      .put(`${API}/leads/${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Nope' });
    expect(res.statusCode).toBe(422);
  });
});

describe('PATCH /leads/:id/status', () => {
  let leadId;

  beforeEach(async () => {
    const res = await request(app)
      .post(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLead);
    leadId = res.body.data._id;
  });

  it('updates status only', async () => {
    const res = await request(app)
      .patch(`${API}/leads/${leadId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Qualified' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('Qualified');
  });
});

describe('DELETE /leads/:id', () => {
  let leadId;

  beforeEach(async () => {
    const res = await request(app)
      .post(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLead);
    leadId = res.body.data._id;
    // Re-login as admin (role was updated after register)
    const loginRes = await request(app).post(`${API}/auth/login`)
      .send({ email: 'admin@test.com', password: 'Admin@1234!' });
    adminToken = loginRes.body.accessToken;
  });

  it('soft-deletes a lead (admin)', async () => {
    const res = await request(app)
      .delete(`${API}/leads/${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Deleted lead should not appear in list
    const listRes = await request(app)
      .get(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`);
    const ids = listRes.body.data.map((l) => l._id);
    expect(ids).not.toContain(leadId);
  });
});

describe('POST /leads/:id/notes', () => {
  let leadId;

  beforeEach(async () => {
    const res = await request(app)
      .post(`${API}/leads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLead);
    leadId = res.body.data._id;
  });

  it('adds a note to a lead', async () => {
    const res = await request(app)
      .post(`${API}/leads/${leadId}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Follow-up scheduled for next Monday.' });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.content).toBe('Follow-up scheduled for next Monday.');
  });

  it('rejects empty note content', async () => {
    const res = await request(app)
      .post(`${API}/leads/${leadId}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '' });
    expect(res.statusCode).toBe(422);
  });
});

describe('POST /leads/public (contact form)', () => {
  beforeEach(async () => {
    // Ensure an admin exists
    await User.findOneAndUpdate(
      { email: 'admin@test.com' },
      { role: 'admin' }
    );
  });

  it('creates a New lead from public form without auth', async () => {
    const res = await request(app)
      .post(`${API}/leads/public`)
      .send({
        fullName: 'Public User',
        email: 'public@user.com',
        message: 'I want to learn more about your product.',
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
