import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';

// Hermetic DB: mock prisma so these tests never touch a real database.
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    society: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Mock Google token verification — route behavior is what we test here.
vi.mock('../lib/google-auth', () => ({
  verifyGoogleIdToken: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { verifyGoogleIdToken } from '../lib/google-auth';
import { AppError, ErrorCodes } from '../lib/app-error';
import app from '../app';

const googleVerify = verifyGoogleIdToken as ReturnType<typeof vi.fn>;
const $tx = prisma.$transaction as ReturnType<typeof vi.fn>;

/** Mock payload returned by Google for a verified, email-confirmed account. */
const googleProfile = (overrides: Record<string, unknown> = {}) => ({
  sub: 'google-sub-123',
  email: 'alice@example.com',
  emailVerified: true,
  name: 'Alice Example',
  ...overrides,
});

/** Mock transaction client used by createSocietyWithFirstAdmin. */
function makeTx() {
  const tx = {
    society: { create: vi.fn() },
    user: { create: vi.fn() },
    membership: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  $tx.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
  return tx;
}

const existingUserRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'u-existing',
  email: 'alice@example.com',
  name: 'Alice Example',
  passwordHash: '$2a$12$hashedpassword',
  googleId: null,
  emailVerified: false,
  ...overrides,
});

const activeMembership = {
  id: 'm1',
  userId: 'u-existing',
  societyId: 's1',
  unitId: null,
  role: 'COMMITTEE_ADMIN',
  status: 'ACTIVE',
  deletedAt: null,
  society: { id: 's1', name: 'Sunrise Apartments', slug: 'sunrise' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('POST /api/v1/auth/google — signin mode', () => {
  it('links an existing user by verified email and logs them in (200, linked=true)', async () => {
    googleVerify.mockResolvedValue(googleProfile());
    (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existingUserRow());
    (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([activeMembership]);
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(existingUserRow({ googleId: 'google-sub-123', emailVerified: true }));
    (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'google-jwt-token', mode: 'signin' });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.user.email).toBe('alice@example.com');
    expect(res.body.data.linked).toBe(true);
    expect(res.body.data.memberships[0].societySlug).toBe('sunrise');
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();

    // Google account linked: googleId + emailVerified written, audit logged
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-existing' },
      data: { googleId: 'google-sub-123', emailVerified: true },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'GOOGLE_ACCOUNT_LINKED' }),
      })
    );

    // Session cookies set (same as password login)
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain('token=');
    expect(cookies.join(';')).toContain('refreshToken=');
  });

  it('does not re-link or re-audit when the Google account is already linked (linked=false)', async () => {
    googleVerify.mockResolvedValue(googleProfile());
    (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      existingUserRow({ googleId: 'google-sub-123', emailVerified: true })
    );
    (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([activeMembership]);

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'google-jwt-token' }); // mode defaults to 'signin'

    expect(res.status).toBe(200);
    expect(res.body.data.linked).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown email WITHOUT creating any user or membership (401)', async () => {
    googleVerify.mockResolvedValue(googleProfile());
    (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'google-jwt-token', mode: 'signin' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toContain('No account exists');
    // The critical rule: no User or Membership may be silently created
    expect($tx).not.toHaveBeenCalled();
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid/tampered Google ID token (401)', async () => {
    // The real verifyGoogleIdToken wraps google-auth-library failures into an
    // AppError(401) — see src/lib/google-auth.test.ts. This test asserts the
    // route surfaces that contract (see the lib test for the wrapping itself).
    googleVerify.mockRejectedValue(
      new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid or expired Google token')
    );

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'tampered-token', mode: 'signin' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toContain('Invalid or expired Google token');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a Google account whose email is not verified (401)', async () => {
    googleVerify.mockResolvedValue(googleProfile({ emailVerified: false }));

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'google-jwt-token', mode: 'signin' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('verified email');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('rejects linking when the email is already bound to a different Google account (409)', async () => {
    googleVerify.mockResolvedValue(googleProfile());
    (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      existingUserRow({ googleId: 'some-other-google-sub' })
    );

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'google-jwt-token', mode: 'signin' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('different Google account');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/google — signup mode (tenant onboarding)', () => {
  const signupBody = {
    idToken: 'google-jwt-token',
    mode: 'signup',
    societyName: 'Sunrise Apartments',
    societySlug: 'sunrise',
  };

  it('creates a new Society + first COMMITTEE_ADMIN via the shared signup transaction (201)', async () => {
    googleVerify.mockResolvedValue(googleProfile());
    (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.society.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const tx = makeTx();
    tx.society.create.mockResolvedValue({ id: 's-new', name: 'Sunrise Apartments', slug: 'sunrise' });
    tx.user.create.mockResolvedValue({
      id: 'u-new',
      email: 'alice@example.com',
      name: 'Alice Example',
      passwordHash: null,
      googleId: 'google-sub-123',
      emailVerified: true,
    });
    tx.membership.create.mockResolvedValue({
      id: 'm-new',
      userId: 'u-new',
      societyId: 's-new',
      role: 'COMMITTEE_ADMIN',
      status: 'ACTIVE',
      unitId: null,
    });

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send(signupBody);

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('alice@example.com');
    expect(res.body.data.memberships[0]).toMatchObject({
      societyName: 'Sunrise Apartments',
      role: 'COMMITTEE_ADMIN',
      status: 'ACTIVE',
    });
    expect(res.body.data.accessToken).toBeTruthy();

    // The created User carries googleId + emailVerified and NO password
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        googleId: 'google-sub-123',
        emailVerified: true,
        passwordHash: null,
      }),
    });
    expect(tx.membership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: 'COMMITTEE_ADMIN', status: 'ACTIVE' }),
    });
    // Tenant onboarding audit entry (same as password signup)
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'SOCIETY_CREATED' }),
    });

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain('token=');
  });

  it('rejects signup when the email already belongs to an existing user (409, like password signup)', async () => {
    googleVerify.mockResolvedValue(googleProfile());
    (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existingUserRow());

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send(signupBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    expect($tx).not.toHaveBeenCalled();
  });

  it('rejects signup when the society slug is already taken (409)', async () => {
    googleVerify.mockResolvedValue(googleProfile());
    (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.society.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 's1', slug: 'sunrise' });

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send(signupBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_ALREADY_EXISTS');
    expect($tx).not.toHaveBeenCalled();
  });

  it('rejects signup without society name/URL (400)', async () => {
    googleVerify.mockResolvedValue(googleProfile());

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'google-jwt-token', mode: 'signup' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect($tx).not.toHaveBeenCalled();
  });

  it('rejects a missing/invalid idToken at the schema boundary (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ mode: 'signin' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(googleVerify).not.toHaveBeenCalled();
  });
});

describe('Google-only accounts cannot use password login', () => {
  it('rejects a password login for a user with no passwordHash (401)', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      existingUserRow({ passwordHash: null, googleId: 'google-sub-123', emailVerified: true })
    );

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'whatever123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});