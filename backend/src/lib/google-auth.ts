import { OAuth2Client } from 'google-auth-library';
import { AppError, ErrorCodes } from './app-error';

// ── Google ID Token Verification ─────────────────────────────────────────────
// Uses Google's official library, which checks signature, audience (client ID),
// and expiry. The returned token is never trusted until this verification has
// passed - it is used exactly once, to prove the user owns the Google account.

export interface VerifiedGoogleProfile {
  /** Google account ID (`sub` claim) - unique per Google account */
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!client) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new AppError(
        ErrorCodes.INTERNAL_ERROR,
        500,
        'GOOGLE_CLIENT_ID is not configured on the server'
      );
    }
    client = new OAuth2Client(clientId);
  }
  return client;
}

/**
 * Verifies a Google ID token (signature + audience + expiry) and returns the
 * verified profile. Throws AppError(401) for any invalid/tampered/expired token.
 */
export async function verifyGoogleIdToken(
  idToken: string
): Promise<VerifiedGoogleProfile> {
  try {
    const ticket = await getClient().verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid Google token');
    }
    return {
      sub: payload.sub,
      email: payload.email ?? null,
      emailVerified: payload.email_verified ?? false,
      name: payload.name ?? null,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    // google-auth-library throws for bad signatures, wrong audience, expiry, etc.
    throw new AppError(
      ErrorCodes.INVALID_CREDENTIALS,
      401,
      'Invalid or expired Google token'
    );
  }
}