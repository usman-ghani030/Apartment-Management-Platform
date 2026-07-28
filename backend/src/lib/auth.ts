import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// ── Password hashing (bcryptjs) ────────────────────────────────────────────

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT Tokens ──────────────────────────────────────────────────────────────

interface TokenPayload {
  userId: string;
}

const accessSecret = () => process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const refreshSecret = () => process.env.JWT_REFRESH_SECRET || 'dev-fallback-refresh-secret';

export function signAccessToken(userId: string): string {
  return jwt.sign({ userId } satisfies TokenPayload, accessSecret(), {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  } as jwt.SignOptions);
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId } satisfies TokenPayload, refreshSecret(), {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, accessSecret()) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, refreshSecret()) as TokenPayload;
}
