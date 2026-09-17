export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const ErrorCodes = {
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  SLUG_ALREADY_EXISTS: 'SLUG_ALREADY_EXISTS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',

  // Internal
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PAYMENT_GATEWAY_ERROR: 'PAYMENT_GATEWAY_ERROR',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  // Storage (ADR 002): credentials missing, or the provider rejected an asset.
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  STORAGE_UPLOAD_INVALID: 'STORAGE_UPLOAD_INVALID',

  // Tenant
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  MEMBERSHIP_REQUIRED: 'MEMBERSHIP_REQUIRED',
  EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
} as const;
