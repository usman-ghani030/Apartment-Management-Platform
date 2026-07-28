import type { ApiResponse, AuthResponse, SignupInput, LoginInput } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, config);
  const json: ApiResponse<T> = await res.json();

  if (json.error) {
    throw new ApiError(json.error.code, json.error.message, res.status);
  }

  return json.data as T;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Convenience HTTP Methods ───────────────────────────────────────────────
export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  const json: ApiResponse<T> = await res.json();
  if (json.error) {
    throw new ApiError(json.error.code, json.error.message, res.status);
  }
  return json.data as T;
}

// ── Auth API ────────────────────────────────────────────────────────────────

export const auth = {
  signup: (data: SignupInput) =>
    request<AuthResponse>('/api/v1/auth/signup', {
      method: 'POST',
      body: data,
    }),

  login: (data: LoginInput) =>
    request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: data,
    }),

  logout: () =>
    request<{ message: string }>('/api/v1/auth/logout', { method: 'POST' }),

  me: () => request<AuthResponse>('/api/v1/auth/me'),

  refresh: () =>
    request<{ message: string }>('/api/v1/auth/refresh', { method: 'POST' }),
};
