import { Readable } from 'stream';
import { AppError, ErrorCodes } from '../app-error';
import { resolveCloudinaryCredentials, type CloudinaryCredentials } from './cloudinary-env';
import type {
  AssetStream,
  ConfirmUploadInput,
  ConfirmedUpload,
  SignedUploadParams,
  StorageProvider,
} from './index';

/**
 * Cloudinary implementation of `StorageProvider` (ADR 002, ADR 007).
 *
 * This is the *only* module in the codebase allowed to import the `cloudinary`
 * SDK. If you need storage somewhere else, add a method to `StorageProvider`
 * instead of importing the SDK next to your feature.
 *
 * Two provider quirks shaped this file (both verified against the live account):
 *
 *  - `allowed_formats` IS part of the signature and IS enforced by Cloudinary: a
 *    PDF uploaded with `allowed_formats=jpg,png` is rejected with a 400.
 *  - `max_file_size` is NOT a signable upload param (including it makes the
 *    signature fail), so Cloudinary cannot enforce the byte limit for us. The
 *    limit is therefore re-checked in `confirmUpload`, where an oversized asset
 *    is rejected and removed. That check - not the browser's - is the boundary.
 */

/**
 * What we sign. Cloudinary recomputes the signature over exactly the non-file
 * params it receives, so this object must contain nothing the client will not
 * send - one extra key produces "Invalid Signature".
 *
 * `type` is deliberately absent: it is part of the upload *URL*
 * (`/image/upload`), not a form field, and signing it broke every real upload
 * until the live test caught it.
 */
interface SignableParams {
  folder: string;
  timestamp: number;
  allowed_formats: string;
}

/** Minimal shape of the SDK surface this file uses. Exported as a test seam. */
export interface CloudinarySdk {
  config(options: {
    cloud_name: string;
    api_key: string;
    api_secret: string;
    secure: boolean;
  }): unknown;
  utils: {
    api_sign_request(params: Record<string, unknown>, apiSecret: string): string;
  };
  url(publicId: string, options?: Record<string, unknown>): string;
  uploader: {
    destroy(publicId: string, options?: Record<string, unknown>): Promise<unknown>;
  };
  api: {
    resource(
      publicId: string,
      options?: Record<string, unknown>
    ): Promise<{ public_id: string; secure_url: string; url: string; format: string; bytes: number }>;
  };
}

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface CloudinaryProviderOptions {
  /** Defaults to whatever the environment resolves to. */
  credentials?: CloudinaryCredentials | null;
  /**
   * Pre-configured SDK handle. Only used by tests - production constructs the
   * provider with no options and lets `client()` load + configure the SDK.
   */
  client?: CloudinarySdk;
}

/**
 * Cloudinary's `/image/upload` endpoint. Every purpose in this codebase uploads
 * an image (ticket photos, payment screenshots) so the resource type is fixed;
 * adding a non-image purpose means adding a resource type here too.
 */
const CLOUDINARY_RESOURCE_TYPE = 'image';

export class CloudinaryStorageProvider implements StorageProvider {
  private api: CloudinarySdk | null;
  private config: CloudinaryConfig | null;

  constructor(options: CloudinaryProviderOptions = {}) {
    const credentials =
      options.credentials === undefined ? resolveCloudinaryCredentials() : options.credentials;
    this.config = credentials
      ? {
          cloudName: credentials.cloudName,
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
        }
      : null;
    this.api = options.client ?? null;
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Lazily load + configure the SDK. Resolution of the credentials has to happen
   * before the SDK module is evaluated, because it reads `CLOUDINARY_URL` at
   * import time and throws on a malformed value.
   */
  private client(): CloudinarySdk {
    const config = this.config;
    if (!config) {
      throw new AppError(
        ErrorCodes.STORAGE_UNAVAILABLE,
        503,
        'File storage is not configured on this server'
      );
    }
    if (this.api) return this.api;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sdk = require('cloudinary') as { v2: CloudinarySdk };
    sdk.v2.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
    this.api = sdk.v2;
    return this.api;
  }

  getSignedUploadParams(input: {
    folder: string;
    allowedFormats: readonly string[];
    maxFileSizeBytes: number;
  }): SignedUploadParams {
    const api = this.client();
    const config = this.config!;

    const timestamp = Math.round(Date.now() / 1000);
    // The signed object and the params handed back to the browser are literally
    // the same values - a mismatch between them is the classic cause of
    // Cloudinary's "Invalid Signature" error.
    const params: SignableParams = {
      folder: input.folder,
      timestamp,
      allowed_formats: input.allowedFormats.join(','),
    };

    const signature = api.utils.api_sign_request(
      params as unknown as Record<string, unknown>,
      config.apiSecret
    );

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/${CLOUDINARY_RESOURCE_TYPE}/upload`,
      cloudName: config.cloudName,
      apiKey: config.apiKey,
      timestamp,
      signature,
      folder: input.folder,
      allowedFormats: params.allowed_formats,
      maxFileSizeBytes: input.maxFileSizeBytes,
      resourceType: CLOUDINARY_RESOURCE_TYPE,
      publicIdPrefix: `${input.folder}/`,
    };
  }

  async confirmUpload(input: ConfirmUploadInput): Promise<ConfirmedUpload> {
    const { publicId, expectedFolder, allowedFormats, maxFileSizeBytes } = input;

    this.assertInsideFolder(publicId, expectedFolder);

    const api = this.client();
    let asset: { public_id: string; secure_url: string; url: string; format: string; bytes: number };
    try {
      asset = await api.api.resource(publicId, { resource_type: CLOUDINARY_RESOURCE_TYPE });
    } catch (err) {
      // The SDK surfaces API failures either flat (`{http_code}`) or nested
      // (`{error: {http_code}}`) depending on the call path - handle both.
      const failure = err as { http_code?: number; error?: { http_code?: number; message?: string } };
      const status = failure.http_code ?? failure.error?.http_code;
      if (status === 404) {
        throw new AppError(
          ErrorCodes.STORAGE_UPLOAD_INVALID,
          400,
          'That upload could not be found - try uploading the file again'
        );
      }
      throw err;
    }

    // Re-assert the tenant folder on the asset we actually got back: the check
    // above is on the caller's string, this is on the provider's own record.
    this.assertInsideFolder(asset.public_id, expectedFolder);

    const format = (asset.format || '').toLowerCase();
    if (allowedFormats.length > 0 && !allowedFormats.map((f) => f.toLowerCase()).includes(format)) {
      await this.delete(asset.public_id);
      throw new AppError(
        ErrorCodes.STORAGE_UPLOAD_INVALID,
        400,
        `That file type (${format || 'unknown'}) is not allowed here`
      );
    }

    if (asset.bytes > maxFileSizeBytes) {
      await this.delete(asset.public_id);
      throw new AppError(
        ErrorCodes.STORAGE_UPLOAD_INVALID,
        400,
        `That file is too large (${Math.ceil(asset.bytes / 1024 / 1024)}MB). The limit is ${Math.floor(
          maxFileSizeBytes / 1024 / 1024
        )}MB.`
      );
    }

    return {
      url: asset.secure_url,
      publicId: asset.public_id,
      format,
      bytes: asset.bytes,
    };
  }

  getUrl(publicId: string, transform?: Record<string, unknown>): string {
    return this.client().url(publicId, { secure: true, ...(transform ?? {}) });
  }

  async openAssetStream(publicId: string): Promise<AssetStream> {
    const api = this.client();
    const asset = await api.api.resource(publicId, { resource_type: CLOUDINARY_RESOURCE_TYPE });
    const url = asset.secure_url || asset.url;

    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new AppError(
        ErrorCodes.STORAGE_UPLOAD_INVALID,
        502,
        'Could not read the stored file'
      );
    }

    return {
      stream: Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
      contentType: res.headers.get('content-type') || 'application/octet-stream',
      contentLength: asset.bytes,
    };
  }

  async delete(publicId: string): Promise<void> {
    await this.client().uploader.destroy(publicId, {
      resource_type: CLOUDINARY_RESOURCE_TYPE,
      invalidate: true,
    });
  }

  /**
   * A public id must live under the folder the session earned a signature for.
   * This is what stops someone reusing a valid signature to register - or a
   * delete request to remove - an unrelated asset, including another tenant's.
   */
  private assertInsideFolder(publicId: string, folder: string): void {
    const expectedPrefix = `${folder}/`;
    if (publicId.includes('..') || !publicId.startsWith(expectedPrefix)) {
      throw new AppError(
        ErrorCodes.STORAGE_UPLOAD_INVALID,
        400,
        'That upload does not belong to the record you are attaching it to'
      );
    }
  }
}

export function createCloudinaryStorageProvider(): CloudinaryStorageProvider {
  return new CloudinaryStorageProvider();
}
