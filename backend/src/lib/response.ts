import { Response } from 'express';
import { AppError } from './app-error';
import type { ApiResponse, PaginatedResponse } from '@apartment/shared';

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const body: ApiResponse<T> = { data, error: null };
  res.status(status).json(body);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  nextCursor: string | null
): void {
  const body = { data, nextCursor, error: null };
  res.status(200).json(body);
}

export function sendError(res: Response, error: AppError): void {
  const body: ApiResponse<null> = {
    data: null,
    error: { code: error.code, message: error.message },
  };
  res.status(error.httpStatus).json(body);
}
