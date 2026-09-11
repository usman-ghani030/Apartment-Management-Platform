import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the Google library so no network calls happen. The shared prototype mock
// means the module-level cached OAuth2Client instance gets the same stub.
vi.mock('google-auth-library', () => {
  class MockOAuth2Client {}
  (MockOAuth2Client as unknown as { prototype: Record<string, unknown> }).prototype.verifyIdToken = vi.fn();
  return { OAuth2Client: MockOAuth2Client };
});

import { OAuth2Client } from 'google-auth-library';
import { verifyGoogleIdToken } from './google-auth';
import { AppError } from './app-error';

const mockVerifyIdToken = (
  OAuth2Client as unknown as {
    prototype: { verifyIdToken: ReturnType<typeof vi.fn> };
  }
).prototype.verifyIdToken;

beforeEach(() => {
  vi.clearAllMocks();
  // verifyGoogleIdToken reads the audience from env at call time
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
});

afterEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  vi.restoreAllMocks();
});

describe('verifyGoogleIdToken', () => {
  it('returns the verified profile from a valid Google ID token', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-123',
        email: 'alice@example.com',
        email_verified: true,
        name: 'Alice Example',
      }),
    });

    const profile = await verifyGoogleIdToken('valid-google-jwt');

    expect(profile).toEqual({
      sub: 'google-sub-123',
      email: 'alice@example.com',
      emailVerified: true,
      name: 'Alice Example',
    });
    // Audience check: the client ID must be passed as the audience
    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'valid-google-jwt',
      audience: 'test-client-id.apps.googleusercontent.com',
    });
  });

  it('wraps a tampered/invalid token failure into AppError(401)', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token signature'));

    await expect(verifyGoogleIdToken('tampered-jwt')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      httpStatus: 401,
    });
  });

  it('rejects a token payload without a sub claim', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'no-sub@example.com', email_verified: true }),
    });

    await expect(verifyGoogleIdToken('weird-jwt')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      httpStatus: 401,
    });
  });

  it('fails fast with a clear error when GOOGLE_CLIENT_ID is not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    await expect(verifyGoogleIdToken('anything')).rejects.toBeInstanceOf(AppError);
  });
});