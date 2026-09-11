import { createHash, randomBytes } from 'crypto';

// ── Reset token generation ──────────────────────────────────────────────────
// Raw token: 256 bits of CSPRNG entropy, sent in the email link. Only its
// SHA-256 hash is ever persisted — a DB leak cannot be replayed as a token.
export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function getResetTokenTtlMinutes(): number {
  const minutes = parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || '45', 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 45;
}

export function getResetTokenTtlMs(): number {
  return getResetTokenTtlMinutes() * 60 * 1000;
}

// ── Email templates ─────────────────────────────────────────────────────────
// Two distinct emails, per the account-type rule:
//   1. Password-having account → reset link with the single-use token.
//   2. Google-only account (no passwordHash) → explain that the account signs
//      in with Google; there is no password to reset and no reset token.

export function buildPasswordResetEmail(resetUrl: string): { subject: string; html: string; text: string } {
  const subject = 'Reset your OmniHome password';
  const minutes = getResetTokenTtlMinutes();
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1f2937;">Reset your password</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
        We received a request to reset the password for your OmniHome account.
        This link is valid for ${minutes} minutes and can only be used once.
      </p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Reset my password
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        If you didn't request this, you can safely ignore this email — your
        password won't change.
      </p>
    </div>
  `;
  const text = `Reset your OmniHome password\n\nWe received a request to reset the password for your OmniHome account. This link is valid for ${minutes} minutes and can only be used once:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
  return { subject, html, text };
}

export function buildGoogleOnlyAccountEmail(loginUrl: string): { subject: string; html: string; text: string } {
  const subject = 'Your OmniHome account uses Google Sign-In';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1f2937;">Your account uses Google Sign-In</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
        We received a password reset request for this email, but this OmniHome
        account was created with <strong>Google Sign-In</strong> and has no
        password set — so there is nothing to reset.
      </p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Sign in with Google
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;
  const text = `Your OmniHome account uses Google Sign-In\n\nWe received a password reset request for this email, but this OmniHome account was created with Google Sign-In and has no password set — so there is nothing to reset.\n\nSign in with Google instead: ${loginUrl}`;
  return { subject, html, text };
}