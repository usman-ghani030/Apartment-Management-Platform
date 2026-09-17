import type { Readable } from 'stream';
import { AppError, ErrorCodes } from '../app-error';

/**
 * Storage abstraction (ADR 002).
 *
 * Everything that touches Cloudinary goes through this interface - no feature
 * file imports the `cloudinary` SDK, so swapping in S3/R2 later is a contained
 * change (see `docs/adr/002-storage-provider.md`).
 *
 * Two flows make up the upload path:
 *  1. `getSignedUploadParams` - the API signs a short-lived upload so the browser
 *     can POST the file straight to the provider. The API secret never reaches
 *     the client and nothing is proxied through Express.
 *  2. `confirmUpload` - called after the browser's upload succeeds, to prove
 *     server-side that the asset exists, lives under the tenant folder we issued
 *     the signature for, and respects the limits we signed.
 */

export interface SignedUploadParams {
  /** Where the browser POSTs the file (provider-specific). */
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  /** Tenant-scoped folder: `omnihome/{societyId}/{resourceType}/{resourceId}`. */
  folder: string;
  /** Comma-joined, and part of the signature - the provider enforces it. */
  allowedFormats: string;
  maxFileSizeBytes: number;
  resourceType: string;
  /** Cloudinary adds a random suffix after this prefix to form the public id. */
  publicIdPrefix: string;
}

export interface ConfirmUploadInput {
  publicId: string;
  /** The folder the caller's session earned a signature for. */
  expectedFolder: string;
  /** Re-checked here because the provider cannot enforce a byte limit itself. */
  allowedFormats: readonly string[];
  maxFileSizeBytes: number;
}

export interface ConfirmedUpload {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
}

export interface AssetStream {
  stream: Readable;
  contentType: string;
  contentLength?: number;
}

export interface StorageProvider {
  /** False when credentials are missing/invalid - routes answer 503, not 500. */
  isConfigured(): boolean;

  /**
   * Signed params the client uses to upload directly to the provider.
   * `folder` is always derived server-side from the session's society.
   */
  getSignedUploadParams(input: {
    folder: string;
    allowedFormats: readonly string[];
    maxFileSizeBytes: number;
  }): SignedUploadParams;

  /**
   * Validate + describe an asset the client just uploaded. Rejects anything
   * outside `expectedFolder`, of the wrong format, or over the size limit.
   */
  confirmUpload(input: ConfirmUploadInput): Promise<ConfirmedUpload>;

  /** Delivery URL for an asset (optionally with provider transformations). */
  getUrl(publicId: string, transform?: Record<string, unknown>): string;

  /**
   * Read the asset's bytes server-side. Payment-proof screenshots are financial
   * evidence (ADR 008): their provider URL is never handed to the browser, so the
   * access-controlled API route streams the bytes through instead.
   */
  openAssetStream(publicId: string): Promise<AssetStream>;

  /** Permanent provider-side deletion. Only ever called from an explicit admin action. */
  delete(publicId: string): Promise<void>;
}

let provider: StorageProvider | null = null;

/**
 * The configured provider, or `null` when storage has not been configured (the
 * routes turn that into a 503 rather than an SDK crash on boot).
 */
export function tryGetStorageProvider(): StorageProvider | null {
  if (!provider) {
    // Imported lazily: the Cloudinary SDK is only evaluated once credentials have
    // been sanitised (see ./cloudinary-env.ts), and a deployment with no storage
    // config never loads it at all.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCloudinaryStorageProvider } = require('./cloudinary') as typeof import('./cloudinary');
    provider = createCloudinaryStorageProvider();
  }
  return provider.isConfigured() ? provider : null;
}

/** The provider, or a 503-shaped AppError explaining that storage is missing. */
export function getStorageProvider(): StorageProvider {
  const configured = tryGetStorageProvider();
  if (!configured) {
    throw new AppError(
      ErrorCodes.STORAGE_UNAVAILABLE,
      503,
      'File storage is not configured on this server'
    );
  }
  return configured;
}

/** Test seams. */
export function setStorageProvider(next: StorageProvider | null): void {
  provider = next;
}
