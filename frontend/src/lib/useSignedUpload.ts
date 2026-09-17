'use client';

import { useCallback, useState } from 'react';
import {
  UPLOAD_PURPOSE_CONFIG,
  type ConfirmedUploadResponse,
  type UploadPurpose,
  type UploadSignatureResponse,
} from '@apartment/shared';
import { ApiError, apiPost } from '@/lib/api';

/**
 * Signed direct-to-Cloudinary upload (ADR 002).
 *
 * Three steps, none of which proxy the file through our API:
 *   1. `POST /api/v1/uploads/signature` - the server decides the folder (from
 *      your session's society) and signs the upload.
 *   2. `POST` the file straight to Cloudinary with those signed params, so the
 *      API secret never reaches the browser.
 *   3. `POST /api/v1/uploads/confirm` - the server verifies the asset exists
 *      under the folder it signed and returns it.
 *
 * The caller then persists the returned `publicId` against its own record.
 */

export interface UploadedAsset {
  publicId: string;
  url: string;
  format: string;
  bytes: number;
}

/** Fast local feedback only - the signed params are the real boundary. */
export function uploadPreflightError(file: File, purpose: UploadPurpose): string | null {
  const config = UPLOAD_PURPOSE_CONFIG[purpose];
  if (!config) return 'Unknown upload type';

  if (config.allowedMimeTypes.length > 0 && !config.allowedMimeTypes.includes(file.type)) {
    const list = config.allowedFormats.map((f) => f.toUpperCase()).join(', ');
    return `${config.label.charAt(0).toUpperCase() + config.label.slice(1)} must be one of: ${list}`;
  }
  if (file.size > config.maxFileSizeBytes) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB - the limit is ${Math.floor(
      config.maxFileSizeBytes / 1024 / 1024
    )}MB.`;
  }
  return null;
}

/** The `accept` attribute a file input should use for a purpose. */
export function uploadAccept(purpose: UploadPurpose): string {
  return UPLOAD_PURPOSE_CONFIG[purpose].allowedMimeTypes.join(',');
}

interface CloudinaryUploadResponse {
  public_id?: string;
  error?: { message?: string };
}

/**
 * Step 2. XMLHttpRequest rather than fetch because only XHR reports upload
 * progress - a spinner with no movement on a slow connection is exactly what the
 * ADR 002 test guide asks us to avoid.
 */
function uploadToCloudinary(
  file: File,
  signed: UploadSignatureResponse,
  onProgress: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', signed.apiKey);
    form.append('timestamp', String(signed.timestamp));
    form.append('signature', signed.signature);
    form.append('folder', signed.folder);
    form.append('allowed_formats', signed.allowedFormats);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', signed.uploadUrl, true);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let body: CloudinaryUploadResponse = {};
      try {
        body = JSON.parse(xhr.responseText) as CloudinaryUploadResponse;
      } catch {
        // Non-JSON response - the status check below reports it.
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.public_id) {
        resolve(body.public_id);
        return;
      }
      reject(
        new ApiError(
          'UPLOAD_FAILED',
          body.error?.message || `Upload failed (HTTP ${xhr.status})`,
          xhr.status
        )
      );
    };
    xhr.onerror = () =>
      reject(new ApiError('UPLOAD_FAILED', 'Upload failed - check your connection and try again', 0));
    xhr.onabort = () => reject(new ApiError('UPLOAD_FAILED', 'Upload cancelled', 0));
    xhr.send(form);
  });
}

export function useSignedUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const upload = useCallback(
    async (file: File, purpose: UploadPurpose, resourceId: string): Promise<UploadedAsset> => {
      const preflight = uploadPreflightError(file, purpose);
      if (preflight) {
        setError(preflight);
        throw new ApiError('VALIDATION_ERROR', preflight, 400);
      }

      setUploading(true);
      setProgress(0);
      setError('');
      try {
        const signed = await apiPost<UploadSignatureResponse>('/api/v1/uploads/signature', {
          purpose,
          resourceId,
        });

        const publicId = await uploadToCloudinary(file, signed, setProgress);

        // The server re-checks the asset really is under the folder it signed for
        // this society/record - and that it respects the signed restrictions.
        const confirmed = await apiPost<ConfirmedUploadResponse>('/api/v1/uploads/confirm', {
          purpose,
          resourceId,
          publicId,
        });

        return {
          publicId: confirmed.publicId,
          url: confirmed.url,
          format: confirmed.format,
          bytes: confirmed.bytes,
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        throw err;
      } finally {
        setUploading(false);
      }
    },
    []
  );

  return { upload, uploading, progress, error, setError };
}
