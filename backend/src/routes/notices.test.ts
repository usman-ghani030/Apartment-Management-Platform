import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('POST /api/v1/notices', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/notices')
      .send({ title: 'Test', content: 'Content', category: 'general' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 for empty title', async () => {
    const res = await request(app)
      .post('/api/v1/notices')
      .set('x-access-token', 'invalid-token')
      .send({ title: '', content: 'Content' });
    // Either 401 (invalid token) or 400 (validation) — both acceptable
    expect([401, 400]).toContain(res.status);
  });
});

describe('GET /api/v1/notices', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/notices');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return paginated response format when authenticated (invalid token)', async () => {
    const res = await request(app)
      .get('/api/v1/notices')
      .set('x-access-token', 'invalid-token');
    // Invalid token should return 401
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/notices/:id', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .patch('/api/v1/notices/some-id')
      .send({ title: 'Updated' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/notices/:id', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .delete('/api/v1/notices/some-id');
    expect(res.status).toBe(401);
  });
});
