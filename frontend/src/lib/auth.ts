/**
 * Thin API client for the backend.
 * - Automatically attaches the access token.
 * - On 401, tries to refresh the token once, then retries the request.
 * - In dev, requests go through the Vite proxy (/api -> localhost:3000).
 *   Set VITE_API_URL for other environments.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

const STORAGE_KEY = 'merb.auth';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: { id: string; name: string; permissions: string[] };
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

function loadState(): AuthState {
  if (typeof localStorage === 'undefined') {
    return { user: null, accessToken: null, refreshToken: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AuthState;
  } catch {
    // corrupted storage — reset
  }
  return { user: null, accessToken: null, refreshToken: null };
}

export function getAuth(): AuthState {
  return loadState();
}

export function setAuth(state: AuthState): void {
  if (typeof localStorage === 'undefined') return;
  if (state.accessToken) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  else localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((l) => l());
}

export function clearAuth(): void {
  setAuth({ user: null, accessToken: null, refreshToken: null });
}

// --- tiny reactive store for React ---
const listeners = new Set<() => void>();
export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export interface LoginResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface ApiResult extends LoginResult {
  message?: string;
}

async function rawRequest<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, (data.error as string) ?? res.statusText, data.details);
  }
  return data as T;
}

async function tryRefresh(): Promise<boolean> {
  const { refreshToken } = getAuth();
  if (!refreshToken) return false;
  try {
    const { user, accessToken, refreshToken: newRefreshToken } = await rawRequest<LoginResult>(
      '/api/v1/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      },
    );
    setAuth({ user, accessToken, refreshToken: newRefreshToken });
    return true;
  } catch {
    clearAuth();
    return false;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const { accessToken } = getAuth();
  try {
    return await rawRequest<T>(path, { ...options, token: accessToken });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && retry) {
      const refreshed = await tryRefresh();
      if (refreshed) return api<T>(path, options, false);
    }
    throw err;
  }
}

// --- auth endpoints ---
export async function login(email: string, password: string): Promise<LoginResult> {
  const { user, accessToken, refreshToken } = await rawRequest<LoginResult>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuth({ user, accessToken, refreshToken });
  return { user, accessToken, refreshToken };
}

export async function register(name: string, email: string, password: string): Promise<LoginResult> {
  const { user, accessToken, refreshToken } = await rawRequest<LoginResult>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setAuth({ user, accessToken, refreshToken });
  return { user, accessToken, refreshToken };
}

export async function logout(): Promise<void> {
  const { refreshToken } = getAuth();
  if (refreshToken) {
    await rawRequest('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  clearAuth();
}

export async function fetchMe(): Promise<AuthUser> {
  const result = await api<{ user: AuthUser }>('/api/v1/auth/me');
  setAuth({ ...getAuth(), user: result.user });
  return result.user;
}

export type { ApiResult };
