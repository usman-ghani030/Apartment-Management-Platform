import type { ApiResponse, AuthResponse, SignupInput, LoginInput } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Token storage (cross-origin safe, no cookies needed) ────────────────────
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    try { localStorage.setItem('omni-auth-token', token); } catch {}
  } else {
    try { localStorage.removeItem('omni-auth-token'); } catch {}
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    try { authToken = localStorage.getItem('omni-auth-token'); } catch {}
  }
  return authToken;
}

// ── Request helper ─────────────────────────────────────────────────────────
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

  // Include auth token if available (works cross-origin without cookies)
  const token = getAuthToken();
  if (token) {
    headers['x-access-token'] = token;
  }

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
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['x-access-token'] = token;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
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
  signup: async (data: SignupInput) => {
    const result = await request<AuthResponse & { accessToken?: string }>('/api/v1/auth/signup', {
      method: 'POST',
      body: data,
    });
    if (result.accessToken) {
      setAuthToken(result.accessToken);
    }
    return result as AuthResponse;
  },

  login: async (data: LoginInput) => {
    const result = await request<AuthResponse & { accessToken?: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: data,
    });
    if (result.accessToken) {
      setAuthToken(result.accessToken);
    }
    return result as AuthResponse;
  },

  logout: async () => {
    setAuthToken(null);
    return request<{ message: string }>('/api/v1/auth/logout', { method: 'POST' });
  },

  me: () => request<AuthResponse>('/api/v1/auth/me'),

  refresh: () =>
    request<{ message: string }>('/api/v1/auth/refresh', { method: 'POST' }),
};
