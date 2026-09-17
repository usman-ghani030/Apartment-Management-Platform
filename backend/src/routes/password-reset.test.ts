import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

// Hermetic DB: mock prisma so these tests never touch a real database.
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: { findUnique: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    membership: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Mock email transport - route behavior is what we test here.
vi.mock('../lib/email', () => ({
  sendEmail: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';
import { passwordResetEmailLimiter, passwordResetIpLimiter } from '../lib/rate-limit';
import { verifyPassword } from '../lib/auth';
import app from '../app';

const emailSend = sendEmail as ReturnType<typeof vi.fn>;
const $tx = prisma.$transaction as ReturnType<typeof vi.fn>;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const SUCCESS_MESSAGE = 'A password reset link has been sent to your email. Check your inbox.';
const GOOGLE_ONLY_MESSAGE = 'This account uses Google Sign-In. Please sign in with Google instead.';

const passwordUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'u-pw',
  email: 'alice@example.com',
  name: 'Alice Example',
  passwordHash: '$2a$12$hashedpassword',
  googleId: null,
  emailVerified: false,
  tokenVersion: 0,
  ...overrides,
});

const googleOnlyUser = (overrides: Record<string, unknown> = {}) =>
  passwordUser({ passwordHash: null, googleId: 'google-sub-123', emailVerified: true, ...overrides });

const resetTokenRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'rt1',
  userId: 'u-pw',
  tokenHash: 'a'.repeat(64),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  usedAt: null,
  createdAt: new Date(),
  user: passwordUser(),
  ...overrides,
});

const activeMembership = {
  id: 'm1', userId: 'u-pw', societyId: 's1', unitId: null,
  role: 'COMMITTEE_ADMIN', status: 'ACTIVE', deletedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Each test starts with a fresh rate-limit window.
  passwordResetEmailLimiter.reset();
  passwordResetIpLimiter.reset();
  $tx.mockImplementation(async (cb: (t: unknown) => unknown) => cb({} as never));
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('POST /api/v1/auth/forgot-password - request endpoint', () => {
  it('creates a hashed, single-use reset token and emails a reset link (200, generic message)', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(passwordUser());
    (prisma.passwordResetToken.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (prisma.passwordResetToken.create as ReturnType<typeof vi.fn>).mockResolvedValue(resetTokenRow());
    emailSend.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'Alice@Example.com' }); // case-insensitive lookup

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.message).toBe(SUCCESS_MESSAGE);

    // A reset email with a single-use token link was sent
    expect(emailSend).toHaveBeenCalledTimes(1);
    const emailArg = emailSend.mock.calls[0][0];
    expect(emailArg.subject).toBe('Reset your OmniHome password');
    expect(emailArg.to).toBe('alice@example.com');

    // Extract the raw token from the emailed link
    const urlMatch = emailArg.html.match(/reset-password\?token=([^"&]+)/);
    expect(urlMatch).not.toBeNull();
    const rawToken = decodeURIComponent(urlMatch![1]);
    expect(rawToken.length).toBeGreaterThanOrEqual(32);

    // Only the SHA-256 hash of the token is persisted - never the raw token
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u-pw',
        tokenHash: sha256(rawToken),
      }),
    });
    // The raw token must not appear anywhere in the stored data
    const createArg = (prisma.passwordResetToken.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(JSON.stringify(createArg)).not.toContain(rawToken);
  });

  it('returns 404 for unknown email (EMAIL_NOT_FOUND)', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EMAIL_NOT_FOUND');
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(emailSend).not.toHaveBeenCalled();
  });

  it('sends the Google-only informational email (no reset link, no token) for a passwordless account', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(googleOnlyUser());
    emailSend.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe(GOOGLE_ONLY_MESSAGE);
    expect(res.body.data.googleOnly).toBe(true);

    // Correct email variant: explains Google Sign-In, links to /login
    expect(emailSend).toHaveBeenCalledTimes(1);
    const emailArg = emailSend.mock.calls[0][0];
    expect(emailArg.subject).toContain('Google Sign-In');
    expect(emailArg.html).toContain('/login');
    expect(emailArg.html).not.toContain('reset-password?token=');

    // Crucially: no reset token is ever created for a passwordless account
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('returns 502 EMAIL_SEND_FAILED (not a false success) when the EmailProvider rejects', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(passwordUser());
    (prisma.passwordResetToken.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (prisma.passwordResetToken.create as ReturnType<typeof vi.fn>).mockResolvedValue(resetTokenRow());
    // Gmail SMTP down / bad app password / daily cap hit
    emailSend.mockRejectedValue(new Error('Gmail SMTP delivery failed: auth'));

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('EMAIL_SEND_FAILED');
    expect(res.body.data).toBeNull();
    // The user is NOT told to check an inbox that will never receive the email
    expect(JSON.stringify(res.body)).not.toContain('has been sent');
  });

  it('returns 502 EMAIL_SEND_FAILED for the Google-only variant too', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(googleOnlyUser());
    emailSend.mockRejectedValue(new Error('Gmail SMTP delivery failed: quota'));

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('EMAIL_SEND_FAILED');
    expect(res.body.data).toBeNull();
  });

  it('rejects a malformed email (400) without touching the DB', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rate-limits repeated requests for the same email (429)', async () => {
    // Mock a real user so requests succeed (unknown emails now 404, not 200)
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.passwordResetToken.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (prisma.passwordResetToken.create as ReturnType<typeof vi.fn>).mockResolvedValue(resetTokenRow());
    emailSend.mockResolvedValue(undefined);

    // Use a known email so requests return 200 and count toward the rate limit
    const knownUser = passwordUser({ email: 'rate@example.com' });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(knownUser);

    for (let i = 0; i < 5; i++) {
      const ok = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'rate@example.com' });
      expect(ok.status).toBe(200);
    }

    const blocked = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'rate@example.com' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('POST /api/v1/auth/reset-password - token consumption', () => {
  it('resets the password end-to-end: consumes the token, hashes the new password, bumps tokenVersion, audits', async () => {
    const rawToken = 'single-use-raw-token';
    (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      resetTokenRow({ tokenHash: sha256(rawToken) })
    );

    // Mock the transaction client (updateMany consumes, user.update writes)
    const tx = {
      passwordResetToken: { updateMany: vi.fn() },
      user: { update: vi.fn() },
    };
    tx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    tx.user.update.mockResolvedValue(passwordUser({ tokenVersion: 1 }));
    $tx.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));

    (prisma.passwordResetToken.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([activeMembership]);
    (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: 'BrandNewPass123' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('password has been reset');

    // Token consumed with an atomic usedAt-null guard (single-use)
    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'rt1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });

    // New password is bcrypt-hashed and verifies; tokenVersion bumped so every
    // outstanding refresh token (other sessions) is invalidated
    const userUpdateArg = tx.user.update.mock.calls[0][0];
    expect(userUpdateArg).toEqual(expect.objectContaining({
      where: { id: 'u-pw' },
      data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
    }));
    expect(userUpdateArg.data.passwordHash).not.toBe('$2a$12$hashedpassword');
    expect(await verifyPassword('BrandNewPass123', userUpdateArg.data.passwordHash)).toBe(true);

    // Audit entry written (no password anywhere in it)
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: 's1',
          action: 'PASSWORD_RESET',
          entityType: 'user',
          entityId: 'u-pw',
        }),
      })
    );
    const auditArg = JSON.stringify((prisma.auditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(auditArg).not.toContain('BrandNewPass123');

    // Any other outstanding links for this user are purged
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u-pw', usedAt: null },
    });
  });

  it('rejects an expired token (400 TOKEN_EXPIRED, nothing consumed)', async () => {
    (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      resetTokenRow({ expiresAt: new Date(Date.now() - 1000) })
    );

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'expired-token', password: 'BrandNewPass123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    expect($tx).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects an already-used token (400 TOKEN_INVALID, nothing consumed)', async () => {
    (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      resetTokenRow({ usedAt: new Date() })
    );

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'used-token', password: 'BrandNewPass123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
    expect($tx).not.toHaveBeenCalled();
  });

  it('rejects a token that loses the single-use race (updateMany count 0 → TOKEN_INVALID)', async () => {
    (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(resetTokenRow());
    const tx = {
      passwordResetToken: { updateMany: vi.fn() },
      user: { update: vi.fn() },
    };
    // A concurrent request consumed the token between our read and write
    tx.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    $tx.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'raced-token', password: 'BrandNewPass123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown/tampered token (400 TOKEN_INVALID)', async () => {
    (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'garbage', password: 'BrandNewPass123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('rejects a weak password (400, matches signup strength rules)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'whatever', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/refresh - tokenVersion session invalidation', () => {
  const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-fallback-refresh-secret';

  it('rejects a refresh token signed before the last password reset (401)', async () => {
    // Token signed at tokenVersion 1, but the user is now at version 0? No -
    // the realistic case: user was reset (now at version 1), token signed at 0.
    const staleToken = jwt.sign({ userId: 'u-pw', tokenVersion: 0 }, REFRESH_SECRET, { expiresIn: '7d' });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(passwordUser({ tokenVersion: 1 }));

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-refresh-token', staleToken);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
    expect(res.body.error.message).toContain('Session expired');
  });

  it('accepts a refresh token matching the current tokenVersion (200)', async () => {
    const freshToken = jwt.sign({ userId: 'u-pw', tokenVersion: 2 }, REFRESH_SECRET, { expiresIn: '7d' });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(passwordUser({ tokenVersion: 2 }));

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-refresh-token', freshToken);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('accepts a legacy token without a tokenVersion claim (treated as version 0)', async () => {
    // Tokens signed before the password-reset change carry no version claim;
    // with the default tokenVersion 0 they must keep working.
    const legacyToken = jwt.sign({ userId: 'u-pw' }, REFRESH_SECRET, { expiresIn: '7d' });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(passwordUser({ tokenVersion: 0 }));

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-refresh-token', legacyToken);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });
});