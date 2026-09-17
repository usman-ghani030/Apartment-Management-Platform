import { describe, it, expect } from 'vitest';
import {
  isCloudinaryConfigured,
  resolveCloudinaryCredentials,
  sanitizeCloudinaryEnv,
} from '../storage/cloudinary-env';

/**
 * Regression tests for a live misconfiguration: the whole `CLOUDINARY_URL=...`
 * line was pasted as the value, and the Cloudinary SDK throws while evaluating
 * its module ("Invalid CLOUDINARY_URL protocol") - which would crash the backend
 * on boot, before any of our error handling runs.
 */

const VALID_URL = 'cloudinary://868123456789012:qYGs3cr3tK3y@swujh4s9';

describe('sanitizeCloudinaryEnv', () => {
  it('leaves a well-formed URL alone', () => {
    const env = { CLOUDINARY_URL: VALID_URL };
    expect(sanitizeCloudinaryEnv(env)).toEqual({ recovered: false, removed: false });
    expect(env.CLOUDINARY_URL).toBe(VALID_URL);
  });

  it('recovers the URL from the whole pasted `KEY=value` line', () => {
    const env = { CLOUDINARY_URL: `CLOUDINARY_URL=${VALID_URL}` };
    const result = sanitizeCloudinaryEnv(env);
    expect(result.recovered).toBe(true);
    expect(env.CLOUDINARY_URL).toBe(VALID_URL);
  });

  it('recovers the URL when the pasted line is quoted', () => {
    const env = { CLOUDINARY_URL: `"CLOUDINARY_URL=${VALID_URL}"` };
    expect(sanitizeCloudinaryEnv(env).recovered).toBe(true);
    expect(env.CLOUDINARY_URL).toBe(VALID_URL);
  });

  it('removes an unusable value instead of letting the SDK throw on import', () => {
    const env = { CLOUDINARY_URL: 'not-a-url-at-all' };
    const result = sanitizeCloudinaryEnv(env);
    expect(result.removed).toBe(true);
    expect(env.CLOUDINARY_URL).toBeUndefined();
  });

  it('is a no-op when the variable is unset', () => {
    const env: Record<string, string | undefined> = {};
    expect(sanitizeCloudinaryEnv(env)).toEqual({ recovered: false, removed: false });
  });
});

describe('resolveCloudinaryCredentials', () => {
  it('uses the three explicit vars, which win over CLOUDINARY_URL', () => {
    // The URL here points at a *different* (stale) cloud; the explicit vars are
    // what .env.example documents, so they must win.
    const creds = resolveCloudinaryCredentials({
      CLOUDINARY_URL: 'cloudinary://111:old-secret@stale-cloud',
      CLOUDINARY_CLOUD_NAME: 'swujh4s9',
      CLOUDINARY_API_KEY: '868123456789012',
      CLOUDINARY_API_SECRET: 'qYGs3cr3tK3y',
    });
    expect(creds).toEqual({
      cloudName: 'swujh4s9',
      apiKey: '868123456789012',
      apiSecret: 'qYGs3cr3tK3y',
      source: 'explicit-vars',
    });
  });

  it('tolerates the values being quoted', () => {
    const creds = resolveCloudinaryCredentials({
      CLOUDINARY_CLOUD_NAME: '"swujh4s9"',
      CLOUDINARY_API_KEY: ' 868123456789012 ',
      CLOUDINARY_API_SECRET: '"qYGs3cr3tK3y"',
    });
    expect(creds?.cloudName).toBe('swujh4s9');
    expect(creds?.apiSecret).toBe('qYGs3cr3tK3y');
  });

  it('falls back to a recovered pasted URL when the explicit vars are missing', () => {
    const creds = resolveCloudinaryCredentials({
      CLOUDINARY_URL: `CLOUDINARY_URL=${VALID_URL}`,
    });
    expect(creds).toEqual({
      cloudName: 'swujh4s9',
      apiKey: '868123456789012',
      apiSecret: 'qYGs3cr3tK3y',
      source: 'cloudinary-url',
    });
  });

  it('returns null when nothing usable is configured', () => {
    expect(resolveCloudinaryCredentials({})).toBeNull();
    expect(resolveCloudinaryCredentials({ CLOUDINARY_URL: 'garbage' })).toBeNull();
    expect(isCloudinaryConfigured({ CLOUDINARY_CLOUD_NAME: 'only-a-name' })).toBe(false);
  });
});
