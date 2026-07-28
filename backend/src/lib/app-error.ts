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

  // Internal
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Tenant
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  MEMBERSHIP_REQUIRED: 'MEMBERSHIP_REQUIRED',
} as const;
