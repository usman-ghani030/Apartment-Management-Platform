import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './app';

describe('GET /api/v1/ping', () => {
  it('should return 200 and data with message: pong', async () => {
    const res = await request(app).get('/api/v1/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { message: 'pong' },
      error: null,
    });
  });
});
