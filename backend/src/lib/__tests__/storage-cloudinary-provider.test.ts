import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudinaryStorageProvider, type CloudinarySdk } from '../storage/cloudinary';

/**
 * `CloudinaryStorageProvider` behaviour with the SDK stubbed - no network, and
 * no risk of touching the real account.
 *
 * The security-relevant parts are all here: what goes into the signature, that
 * the API secret never leaves the server, and that `confirmUpload` refuses
 * anything outside the tenant folder it was asked about.
 *
 * The SDK is injected rather than module-mocked because the provider loads it
 * with a lazy `require` (it must not be evaluated before the env is sanitised),
 * which module mocking does not intercept.
 */

const sdk = {
  config: vi.fn(),
  utils: { api_sign_request: vi.fn(() => 'signed-hash') },
  url: vi.fn((publicId: string) => `https://res.cloudinary.com/demo/image/upload/${publicId}`),
  uploader: { destroy: vi.fn(async () => ({ result: 'ok' })) },
  api: { resource: vi.fn() },
};

const sdkHandle = sdk as unknown as CloudinarySdk;
const signRequest = sdk.utils.api_sign_request as ReturnType<typeof vi.fn>;
const resource = sdk.api.resource as ReturnType<typeof vi.fn>;
const destroy = sdk.uploader.destroy as ReturnType<typeof vi.fn>;

const CREDS = { cloudName: 'demo', apiKey: '123456789012345', apiSecret: 'super-secret', source: 'explicit-vars' as const };
const FOLDER = 'omnihome/s1/tickets/tkt-1';
const PUBLIC_ID = `${FOLDER}/abc123`;

function provider() {
  return new CloudinaryStorageProvider({ credentials: CREDS, client: sdkHandle });
}

function asset(overrides: Record<string, unknown> = {}) {
  return {
    public_id: PUBLIC_ID,
    secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${PUBLIC_ID}.png`,
    url: `http://res.cloudinary.com/demo/image/upload/v1/${PUBLIC_ID}.png`,
    format: 'png',
    bytes: 2048,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSignedUploadParams', () => {
  it('signs the folder, timestamp and formats - and never the secret', () => {
    const params = provider().getSignedUploadParams({
      folder: FOLDER,
      allowedFormats: ['jpg', 'png'],
      maxFileSizeBytes: 10 * 1024 * 1024,
    });

    const signed = signRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(signed).toMatchObject({ folder: FOLDER, allowed_formats: 'jpg,png' });
    expect(typeof signed.timestamp).toBe('number');
    expect(signRequest.mock.calls[0][1]).toBe(CREDS.apiSecret);

    expect(params).toMatchObject({
      cloudName: 'demo',
      apiKey: CREDS.apiKey,
      folder: FOLDER,
      allowedFormats: 'jpg,png',
      resourceType: 'image',
      maxFileSizeBytes: 10 * 1024 * 1024,
    });
    expect(params.uploadUrl).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');

    // Nothing secret may be serialisable into a response body.
    expect(JSON.stringify(params)).not.toContain(CREDS.apiSecret);
  });

  it('signs exactly the params the client sends - an extra key breaks the upload', () => {
    // Regression: signing a `type` field that the browser never posts made
    // Cloudinary answer every real upload with "Invalid Signature", because it
    // recomputes the signature over just the received (non-file) params.
    const params = provider().getSignedUploadParams({
      folder: FOLDER,
      allowedFormats: ['png'],
      maxFileSizeBytes: 1024,
    });

    const signed = signRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(signed).sort()).toEqual(['allowed_formats', 'folder', 'timestamp']);

    // Everything signed is echoed to the client, unforgeably and unchanged:
    // the client posts folder/timestamp/allowed_formats + api_key + signature.
    expect(signed.folder).toBe(params.folder);
    expect(signed.allowed_formats).toBe(params.allowedFormats);
    expect(signed.timestamp).toBe(params.timestamp);
    expect(params.uploadUrl).not.toContain('type=');
  });
});

describe('confirmUpload', () => {
  it('accepts an asset inside the expected folder and reports its real size/format', async () => {
    resource.mockResolvedValue(asset());

    const result = await provider().confirmUpload({
      publicId: PUBLIC_ID,
      expectedFolder: FOLDER,
      allowedFormats: ['jpg', 'png'],
      maxFileSizeBytes: 10 * 1024 * 1024,
    });

    expect(resource).toHaveBeenCalledWith(PUBLIC_ID, { resource_type: 'image' });
    expect(result).toMatchObject({ publicId: PUBLIC_ID, format: 'png', bytes: 2048 });
    expect(destroy).not.toHaveBeenCalled();
  });

  it('refuses a public id outside the folder the session was signed for', async () => {
    await expect(
      provider().confirmUpload({
        publicId: 'omnihome/s2/tickets/other-ticket/abc123',
        expectedFolder: FOLDER,
        allowedFormats: ['jpg', 'png'],
        maxFileSizeBytes: 10 * 1024 * 1024,
      })
    ).rejects.toMatchObject({ httpStatus: 400 });

    // Nothing was even looked up in the other tenant's folder.
    expect(resource).not.toHaveBeenCalled();
  });

  it('refuses a traversal attempt', async () => {
    await expect(
      provider().confirmUpload({
        publicId: `${FOLDER}/../tkt-2/abc123`,
        expectedFolder: FOLDER,
        allowedFormats: ['jpg', 'png'],
        maxFileSizeBytes: 10 * 1024 * 1024,
      })
    ).rejects.toMatchObject({ httpStatus: 400 });
  });

  it('re-checks the folder on the provider record, not just the caller string', async () => {
    // The client asked about the right id, but the provider says it lives
    // elsewhere (renamed/redirected) - that must not be accepted.
    resource.mockResolvedValue(asset({ public_id: 'omnihome/s9/tickets/tkt-9/zzz' }));

    await expect(
      provider().confirmUpload({
        publicId: PUBLIC_ID,
        expectedFolder: FOLDER,
        allowedFormats: ['jpg', 'png'],
        maxFileSizeBytes: 10 * 1024 * 1024,
      })
    ).rejects.toMatchObject({ httpStatus: 400 });
  });

  it('rejects a disallowed format and removes the asset', async () => {
    resource.mockResolvedValue(asset({ format: 'pdf' }));

    await expect(
      provider().confirmUpload({
        publicId: PUBLIC_ID,
        expectedFolder: FOLDER,
        allowedFormats: ['jpg', 'png'],
        maxFileSizeBytes: 10 * 1024 * 1024,
      })
    ).rejects.toMatchObject({ httpStatus: 400, code: 'STORAGE_UPLOAD_INVALID' });

    expect(destroy).toHaveBeenCalledWith(PUBLIC_ID, expect.objectContaining({ resource_type: 'image' }));
  });

  it('rejects an oversized asset and removes it (Cloudinary cannot enforce this for us)', async () => {
    resource.mockResolvedValue(asset({ bytes: 12 * 1024 * 1024 }));

    await expect(
      provider().confirmUpload({
        publicId: PUBLIC_ID,
        expectedFolder: FOLDER,
        allowedFormats: ['jpg', 'png'],
        maxFileSizeBytes: 10 * 1024 * 1024,
      })
    ).rejects.toMatchObject({ httpStatus: 400, code: 'STORAGE_UPLOAD_INVALID' });

    expect(destroy).toHaveBeenCalled();
  });

  it('turns a provider 404 into a 400 the user can act on', async () => {
    resource.mockRejectedValue({ http_code: 404, message: 'not found' });

    await expect(
      provider().confirmUpload({
        publicId: PUBLIC_ID,
        expectedFolder: FOLDER,
        allowedFormats: ['jpg', 'png'],
        maxFileSizeBytes: 10 * 1024 * 1024,
      })
    ).rejects.toMatchObject({ httpStatus: 400, message: expect.stringContaining('could not be found') });
  });
});

describe('delete / getUrl / isConfigured', () => {
  it('destroys server-side only', async () => {
    await provider().delete(PUBLIC_ID);
    expect(destroy).toHaveBeenCalledWith(PUBLIC_ID, { resource_type: 'image', invalidate: true });
  });

  it('builds a delivery URL', () => {
    expect(provider().getUrl(PUBLIC_ID)).toContain(PUBLIC_ID);
  });

  it('reports missing configuration instead of throwing at import time', () => {
    const unconfigured = new CloudinaryStorageProvider({ credentials: null, client: sdkHandle });
    expect(unconfigured.isConfigured()).toBe(false);
    expect(() =>
      unconfigured.getSignedUploadParams({ folder: FOLDER, allowedFormats: ['png'], maxFileSizeBytes: 1 })
    ).toThrowError(/not configured/);
  });
});
