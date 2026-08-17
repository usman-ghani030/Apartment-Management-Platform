import type { ApiResponse, AuthResponse, SignupInput, LoginInput } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Token storage (cross-origin safe, no cookies needed) ────────────────────
let authToken: string | null = null;
let refreshToken: string | null = null;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

export function setAuthToken(token: string | null) {
  authToken = token;
  safeSet('omni-auth-token', token);
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = safeGet('omni-auth-token');
  }
  return authToken;
}

export function setRefreshToken(token: string | null) {
  refreshToken = token;
  safeSet('omni-auth-refresh-token', token);
}

export function getRefreshToken(): string | null {
  if (!refreshToken) {
    refreshToken = safeGet('omni-auth-refresh-token');
  }
  return refreshToken;
}

// ── Single-flight refresh: only one refresh request runs at a time ──────────
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = getRefreshToken();
      try {
        // Send the stored refresh token via header; the httpOnly cookie is the
        // fallback for sessions created before refresh tokens were persisted.
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (refresh) headers['x-refresh-token'] = refresh;
        const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers,
        });
        const json = await res.json();
        if (json.error || !json.data?.accessToken) {
          // Refresh failed — clear both tokens so callers treat the user as logged out
          setAuthToken(null);
          setRefreshToken(null);
          return null;
        }
        setAuthToken(json.data.accessToken);
        setRefreshToken(json.data.refreshToken || refresh);
        return json.data.accessToken as string;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

// ── Request helper ─────────────────────────────────────────────────────────
interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  allowRefresh = true
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

  // If the access token expired, silently refresh once and retry the request.
  // This is what keeps users logged in across the 15-minute access token lifetime.
  if (res.status === 401 && allowRefresh && !path.startsWith('/api/v1/auth/')) {
    const newToken = await tryRefreshAccessToken();
    if (newToken) {
      headers['x-access-token'] = newToken;
      return request<T>(path, options, false);
    }
  }

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
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers['x-access-token'] = token;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  });

  // Same expired-token recovery as request(): refresh once and retry the upload.
  if (res.status === 401 && !path.startsWith('/api/v1/auth/')) {
    const newToken = await tryRefreshAccessToken();
    if (newToken) {
      headers['x-access-token'] = newToken;
      const retry = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      });
      const retryJson: ApiResponse<T> = await retry.json();
      if (retryJson.error) {
        throw new ApiError(retryJson.error.code, retryJson.error.message, retry.status);
      }
      return retryJson.data as T;
    }
  }

  const json: ApiResponse<T> = await res.json();
  if (json.error) {
    throw new ApiError(json.error.code, json.error.message, res.status);
  }
  return json.data as T;
}

// ── Auth API ────────────────────────────────────────────────────────────────

export const auth = {
  signup: async (data: SignupInput) => {
    const result = await request<AuthResponse & { accessToken?: string; refreshToken?: string }>('/api/v1/auth/signup', {
      method: 'POST',
      body: data,
    });
    if (result.accessToken) {
      setAuthToken(result.accessToken);
    }
    if (result.refreshToken) {
      setRefreshToken(result.refreshToken);
    }
    return result as AuthResponse;
  },

  login: async (data: LoginInput) => {
    const result = await request<AuthResponse & { accessToken?: string; refreshToken?: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: data,
    });
    if (result.accessToken) {
      setAuthToken(result.accessToken);
    }
    if (result.refreshToken) {
      setRefreshToken(result.refreshToken);
    }
    return result as AuthResponse;
  },

  logout: async () => {
    setAuthToken(null);
    setRefreshToken(null);
    return request<{ message: string }>('/api/v1/auth/logout', { method: 'POST' });
  },

  me: () => request<AuthResponse>('/api/v1/auth/me'),

  refresh: () =>
    request<{ message: string; accessToken?: string; refreshToken?: string }>('/api/v1/auth/refresh', {
      method: 'POST',
      headers: getRefreshToken() ? { 'x-refresh-token': getRefreshToken()! } : {},
    }),
};
