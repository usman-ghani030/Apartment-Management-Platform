import type {
  ApiResponse,
  AuthResponse,
  SignupInput,
  LoginInput,
  VendorStatusUpdate,
  VendorTicketView,
  PlatformInvoiceResponse,
  PlatformCustomQuoteFlagResponse,
  PlatformBillingRunResult,
  PlatformOverdueResult,
  PlatformBillingStatus,
} from '@apartment/shared';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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

  // Google Sign-In — `linked` is true when the Google account was just linked to
  // an existing password-based account (frontend shows a confirmation message).
  googleSignIn: async (idToken: string) => {
    const result = await request<AuthResponse & { accessToken?: string; refreshToken?: string; linked?: boolean }>('/api/v1/auth/google', {
      method: 'POST',
      body: { idToken, mode: 'signin' },
    });
    if (result.accessToken) {
      setAuthToken(result.accessToken);
    }
    if (result.refreshToken) {
      setRefreshToken(result.refreshToken);
    }
    return result as AuthResponse & { linked?: boolean };
  },

  // Google Sign-Up — creates a new Society + first admin, same as password signup
  googleSignUp: async (idToken: string, societyName: string, societySlug: string) => {
    const result = await request<AuthResponse & { accessToken?: string; refreshToken?: string }>('/api/v1/auth/google', {
      method: 'POST',
      body: { idToken, mode: 'signup', societyName, societySlug },
    });
    if (result.accessToken) {
      setAuthToken(result.accessToken);
    }
    if (result.refreshToken) {
      setRefreshToken(result.refreshToken);
    }
    return result as AuthResponse;
  },

  forgotPassword: (email: string) =>
    request<{ message: string; googleOnly?: boolean }>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    }),

  // Public runtime config for the Google button. Used as a fallback when the
  // build didn't have NEXT_PUBLIC_GOOGLE_CLIENT_ID (build-time-only inlining).
  googleConfig: () => request<{ clientId: string | null }>('/api/v1/auth/google/config'),

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

// ── Vendor Portal API (public) ───────────────────────────────────────────────
// Vendors have no accounts — the secret token in their emailed link is the only
// credential, so these calls are unauthenticated by design.
export const vendorPortal = {
  getTicket: (token: string) =>
    request<VendorTicketView>(`/api/v1/vendor/ticket/${encodeURIComponent(token)}`),

  updateStatus: (token: string, status: VendorStatusUpdate) =>
    request<VendorTicketView>(`/api/v1/vendor/ticket/${encodeURIComponent(token)}/status`, {
      method: 'PATCH',
      body: { status },
    }),
};

// ── Platform Billing API (Phase 9, ADR 006) ─────────────────────────────────
// Societies paying the PLATFORM — separate from resident dues (auth/invoices).
export const platformBilling = {
  /** Own society's current standing: unit count, free-tier flag, estimated fee. */
  getStatus: () =>
    request<PlatformBillingStatus>('/api/v1/platform-billing/status'),

  /** Own society's invoice history (Committee Admin, read-only). */
  listMine: () =>
    request<PlatformInvoiceResponse[]>('/api/v1/platform-billing'),

  /** Platform-ops: all societies' invoices (SUPER_ADMIN membership only). */
  listAll: () =>
    request<PlatformInvoiceResponse[]>('/api/v1/platform-billing/all'),

  /** Platform-ops: societies flagged for a custom quote (501+ units). */
  listCustomQuotes: () =>
    request<PlatformCustomQuoteFlagResponse[]>('/api/v1/platform-billing/custom-quotes'),

  /** Platform-ops: run the monthly generation (dryRun first!). */
  runGeneration: (dryRun: boolean) =>
    request<PlatformBillingRunResult>('/api/v1/platform-billing/run-generation', {
      method: 'POST',
      body: { dryRun },
    }),

  /** Platform-ops: run the overdue sweep now. */
  runOverdueCheck: () =>
    request<PlatformOverdueResult>('/api/v1/platform-billing/run-overdue-check', {
      method: 'POST',
    }),

  /** Platform-ops: the ONLY way an invoice becomes PAID. */
  markPaid: (id: string) =>
    request<PlatformInvoiceResponse>(`/api/v1/platform-billing/${id}/mark-paid`, {
      method: 'PATCH',
      body: {},
    }),
};
