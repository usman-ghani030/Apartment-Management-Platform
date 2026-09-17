/**
 * Cloudinary credential resolution (ADR 002).
 *
 * The Cloudinary Node SDK reads `CLOUDINARY_URL` from the environment the moment
 * its module is evaluated, and it *throws* if the value is not a `cloudinary://`
 * URL:
 *
 *   Error: Invalid CLOUDINARY_URL protocol. URL should begin with 'cloudinary://'
 *
 * A very easy mistake is to paste the whole `.env` line as the value, so the
 * variable ends up holding `CLOUDINARY_URL=cloudinary://key:secret@cloud` (and
 * often the surrounding quotes too). That crashes the process at import time,
 * before any of our own error handling can run.
 *
 * So credentials are resolved here, with two jobs:
 *  1. normalise a `CLOUDINARY_URL` that was pasted with its own key/quotes, and
 *     drop one that cannot be salvaged (so requiring the SDK never throws);
 *  2. prefer the three explicit vars, falling back to a well-formed URL.
 *
 * Resolution is lazy (called from the provider, not at module load) so importing
 * this file never touches the SDK or the network.
 */

/** Valid `cloudinary://<api_key>:<api_secret>@<cloud_name>`. */
const CLOUDINARY_URL_PATTERN = /^cloudinary:\/\/\d+:[^@\s]+@[a-z0-9_-]+$/;

/** A well-formed URL embedded in a longer, accidentally-pasted string. */
const EMBEDDED_URL_PATTERN = /cloudinary:\/\/\d+:[^@\s"'\\]+@[a-z0-9_-]+/;

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Where the credentials came from - surfaced in logs/first-use diagnostics. */
  source: 'explicit-vars' | 'cloudinary-url';
}

export interface SanitizeResult {
  /** The pasted-line form was recognised and reduced to a usable URL. */
  recovered: boolean;
  /** The value was unusable and has been removed from the environment. */
  removed: boolean;
  /** The pasted value, for the warning message (never the secret). */
  problem?: string;
}

type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Make `process.env.CLOUDINARY_URL` safe to hand to the SDK.
 *
 * Must be called before `require('cloudinary')` is first evaluated. Returns what
 * it did so the caller can log a single actionable warning.
 */
export function sanitizeCloudinaryEnv(env: Env = process.env): SanitizeResult {
  const raw = env.CLOUDINARY_URL;
  if (!raw) return { recovered: false, removed: false };

  const trimmed = raw.trim();
  if (CLOUDINARY_URL_PATTERN.test(trimmed)) return { recovered: false, removed: false };

  // Case 1: the whole `KEY=value` line (optionally quoted) was pasted as the
  // value. Recover the inner URL rather than making the operator retype it.
  const embedded = trimmed.match(EMBEDDED_URL_PATTERN)?.[0];
  if (embedded) {
    env.CLOUDINARY_URL = embedded;
    return {
      recovered: true,
      removed: false,
      problem: `CLOUDINARY_URL contained the whole \`CLOUDINARY_URL=...\` line; used the \`cloudinary://\` URL inside it instead`,
    };
  }

  // Case 2: unusable. Delete it, otherwise requiring the SDK throws.
  delete env.CLOUDINARY_URL;
  return {
    recovered: false,
    removed: true,
    problem: 'CLOUDINARY_URL is not a cloudinary:// URL - ignoring it and falling back to CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET',
  };
}

/**
 * Resolve usable credentials, or `null` when storage is not configured (the
 * callers turn that into a clear 503 rather than a crash).
 *
 * The three explicit vars win over `CLOUDINARY_URL`: they are what
 * `.env.example` documents and they cannot go stale against a URL that still
 * holds an old key.
 */
export function resolveCloudinaryCredentials(env: Env = process.env): CloudinaryCredentials | null {
  sanitizeCloudinaryEnv(env);

  const cloudName = clean(env.CLOUDINARY_CLOUD_NAME);
  const apiKey = clean(env.CLOUDINARY_API_KEY);
  const apiSecret = clean(env.CLOUDINARY_API_SECRET);
  if (cloudName && apiKey && apiSecret) {
    return { cloudName, apiKey, apiSecret, source: 'explicit-vars' };
  }

  const url = clean(env.CLOUDINARY_URL);
  const match = url.match(/^cloudinary:\/\/(\d+):([^@\s]+)@([a-z0-9_-]+)$/);
  if (match) {
    return { cloudName: match[3], apiKey: match[1], apiSecret: match[2], source: 'cloudinary-url' };
  }

  return null;
}

/** True when storage is configured at all - used to answer with 503 vs 500. */
export function isCloudinaryConfigured(env: Env = process.env): boolean {
  return resolveCloudinaryCredentials(env) !== null;
}
