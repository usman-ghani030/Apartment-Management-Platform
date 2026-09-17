import type { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendError } from '../lib/response';
import { ZodError } from 'zod';
import { PaymentProviderError } from '../lib/payment-provider';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Known application error
  if (err instanceof AppError) {
    sendError(res, err);
    return;
  }

  // Zod validation error - transform into a friendly AppError.
  // `instanceof` can miss when two copies of zod land in the module graph
  // (vitest does this), so duck-type as a fallback: name + issues array.
  const issues = (err as { issues?: unknown[]; errors?: unknown[] }).issues
    ?? (err as { errors?: unknown[] }).errors;
  if (err instanceof ZodError || (err.name === 'ZodError' && Array.isArray(issues))) {
    const message = (issues as { path: (string | number)[]; message: string }[])
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    sendError(res, new AppError(ErrorCodes.VALIDATION_ERROR, 400, message));
    return;
  }

  // Multer upload errors - surface as clear 400 validation errors, not 500s.
  if (err.name === 'MulterError') {
    const code = (err as { code?: string }).code;
    const message =
      code === 'LIMIT_FILE_SIZE'
        ? 'File is too large'
        : code === 'LIMIT_FILE_COUNT'
          ? 'Too many files uploaded'
          : code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Unexpected file field'
            : 'File upload failed';
    sendError(res, new AppError(ErrorCodes.VALIDATION_ERROR, 400, message));
    return;
  }

  // Payment gateway failure - the provider logs the full Safepay reason server-side;
  // the client gets a clear, honest message (no internal details leaked).
  if (err instanceof PaymentProviderError) {
    console.error(`[PaymentGateway] ${err.message} - check SAFEPAY_* env vars and Railway logs for the Safepay error detail`);
    sendError(
      res,
      new AppError(
        ErrorCodes.PAYMENT_GATEWAY_ERROR,
        502,
        'We could not start the payment right now. Please try again in a moment, or contact your society admin.'
      )
    );
    return;
  }

  // Prisma known request error (e.g. unique constraint violation)
  if (err.name === 'PrismaClientKnownRequestError' && 'code' in err) {
    const prismaErr = err as { code: string; meta?: { target?: string[] } };
    if (prismaErr.code === 'P2002') {
      const field = prismaErr.meta?.target?.join(', ') || 'field';
      sendError(
        res,
        new AppError(ErrorCodes.CONFLICT, 409, `Unique constraint violation on ${field}`)
      );
      return;
    }
    if (prismaErr.code === 'P2025') {
      sendError(res, new AppError(ErrorCodes.NOT_FOUND, 404, 'Record not found'));
      return;
    }
  }

  // Unexpected errors - log full details and return generic 500
  const errorId = Math.random().toString(36).substring(2, 10);
  console.error(`[UnhandledError:${errorId}]`, err instanceof Error ? err.stack || err.message : err);
  sendError(
    res,
    new AppError(ErrorCodes.INTERNAL_ERROR, 500, `An unexpected error occurred (ref: ${errorId})`)
  );

}
