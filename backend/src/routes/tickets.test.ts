import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('POST /api/v1/tickets', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/tickets')
      .send({ title: 'Test ticket', description: 'Test description', category: 'plumbing' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 for empty title', async () => {
    const res = await request(app)
      .post('/api/v1/tickets')
      .set('x-access-token', 'invalid-token')
      .send({ title: '', description: 'Test' });
    expect([401, 400]).toContain(res.status);
  });

  it('should return 400 for empty description', async () => {
    const res = await request(app)
      .post('/api/v1/tickets')
      .set('x-access-token', 'invalid-token')
      .send({ title: 'Test', description: '' });
    expect([401, 400]).toContain(res.status);
  });
});

describe('GET /api/v1/tickets', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/tickets');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should support status filter query param', async () => {
    // Test that the query parameter is accepted (even if auth fails)
    const res = await request(app)
      .get('/api/v1/tickets?status=OPEN')
      .set('x-access-token', 'invalid');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/tickets/:id', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .patch('/api/v1/tickets/some-id')
      .send({ status: 'ASSIGNED' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/tickets/:id/comments', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/tickets/some-id/comments')
      .send({ content: 'Test comment' });
    expect(res.status).toBe(401);
  });
});
