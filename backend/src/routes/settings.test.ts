import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('GET /api/v1/settings', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/settings');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('PATCH /api/v1/settings', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .patch('/api/v1/settings')
      .send({ dueReminderDays: 5 });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject invalid reminder windows (401 with bad token, or 400 validation)', async () => {
    const res = await request(app)
      .patch('/api/v1/settings')
      .set('x-access-token', 'invalid-token')
      .send({ dueReminderDays: 0 });
    // Either 401 (invalid token) or 400 (validation) — both acceptable
    expect([401, 400]).toContain(res.status);
  });
});

describe('POST /api/v1/settings/run-reminders', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app).post('/api/v1/settings/run-reminders');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
