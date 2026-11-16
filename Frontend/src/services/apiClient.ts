import { API_BASE_URL } from './apiConfig';

/**
 * One shared HTTP client for the whole app:
 *  - attaches the right access token (buyer / superadmin / rider) as `Authorization: Bearer`
 *  - refreshes an expired token once (single-flight) using the httpOnly refresh cookie, then retries
 *  - announces a rate-limit block (429) and a finished session so the UI can react with a toast
 *  - de-duplicates + briefly caches public GETs so normal browsing stays under the server's per-route limit
 */

export type Role = 'buyer' | 'superadmin' | 'rider';

const TOKEN_KEYS: Record<Role, string> = {
  buyer: 'petal_pen_token',
  superadmin: 'petal_pen_admin_token',
  rider: 'petal_pen_rider_token',
};

const REFRESH_TOKEN_KEYS: Record<Role, string> = {
  buyer: 'petal_pen_refresh_token',
  superadmin: 'petal_pen_admin_refresh_token',
  rider: 'petal_pen_rider_refresh_token',
};

const REFRESH_PATHS: Record<Role, string> = {
  buyer: '/auth/refresh',
  superadmin: '/auth/admin/refresh',
  rider: '/auth/rider/refresh',
};

const LOGOUT_PATHS: Record<Role, string> = {
  buyer: '/auth/logout',
  superadmin: '/auth/admin/logout',
  rider: '/auth/rider/logout',
};

const DEFAULT_TIMEOUT_MS = 20_000;
const REFRESH_TIMEOUT_MS = 15_000;
/** Wait before retrying a refresh that lost a race with a parallel one (409). */
const REFRESH_CONFLICT_RETRY_MS = 1_000;
/** Refresh a token this long before it actually expires. */
const REFRESH_SKEW_MS = 30_000;

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfter?: number;
  /** Extra fields the server sent alongside the error (e.g. `requiresOtp`, `email`). */
  data: Record<string, any>;

  constructor(message: string, status: number, data: Record<string, any> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = data.code;
    this.retryAfter = data.retryAfter;
    this.data = data;
  }
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------
export const tokenStore = {
  get(role: Role): string | null {
    try {
      return localStorage.getItem(TOKEN_KEYS[role]);
    } catch {
      return null;
    }
  },
  set(role: Role, token: string): void {
    try {
      localStorage.setItem(TOKEN_KEYS[role], token);
    } catch {
      /* storage unavailable: the session just will not survive a reload */
    }
  },
  /** Copy of the refresh cookie, for phone browsers that block cross-site cookies (iOS Safari, PWAs). */
  getRefresh(role: Role): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEYS[role]);
    } catch {
      return null;
    }
  },
  /** Forget the access token and the refresh token: the session is over. */
  clear(role: Role): void {
    try {
      localStorage.removeItem(TOKEN_KEYS[role]);
      localStorage.removeItem(REFRESH_TOKEN_KEYS[role]);
    } catch {
      /* ignore */
    }
  },
};

/** Keep the tokens from a login or refresh response. */
export const saveSessionTokens = (role: Role, data: { token?: unknown; refreshToken?: unknown }): void => {
  if (typeof data.token === 'string') tokenStore.set(role, data.token);
  if (typeof data.refreshToken !== 'string') return;
  try {
    localStorage.setItem(REFRESH_TOKEN_KEYS[role], data.refreshToken);
  } catch {
    /* storage unavailable: the refresh cookie (where allowed) still works */
  }
};

/** Milliseconds until the JWT expires (negative if already expired, null if unreadable). */
export const tokenMsRemaining = (token: string): number | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 - Date.now() : null;
  } catch {
    return null;
  }
};

export const isTokenFresh = (token: string): boolean => {
  const remaining = tokenMsRemaining(token);
  return remaining !== null && remaining > REFRESH_SKEW_MS;
};

// ---------------------------------------------------------------------------
// Events (session ended / rate limited)
// ---------------------------------------------------------------------------
const bus = new EventTarget();

export interface SessionEndedDetail {
  role: Role;
  reason: string;
}
export interface RateLimitedDetail {
  retryAfter: number;
}

export const emitSessionEnded = (role: Role, reason: string): void => {
  tokenStore.clear(role);
  bus.dispatchEvent(new CustomEvent<SessionEndedDetail>('session-ended', { detail: { role, reason } }));
};

export const onSessionEnded = (listener: (detail: SessionEndedDetail) => void): (() => void) => {
  const handler = (event: Event) => listener((event as CustomEvent<SessionEndedDetail>).detail);
  bus.addEventListener('session-ended', handler);
  return () => bus.removeEventListener('session-ended', handler);
};

export const onRateLimited = (listener: (detail: RateLimitedDetail) => void): (() => void) => {
  const handler = (event: Event) => listener((event as CustomEvent<RateLimitedDetail>).detail);
  bus.addEventListener('rate-limited', handler);
  return () => bus.removeEventListener('rate-limited', handler);
};

let lastRateLimitToastAt = 0;
const announceRateLimited = (retryAfter: number): void => {
  // One popup per block window, not one per failed request
  if (Date.now() - lastRateLimitToastAt < 5_000) return;
  lastRateLimitToastAt = Date.now();
  bus.dispatchEvent(new CustomEvent<RateLimitedDetail>('rate-limited', { detail: { retryAfter } }));
};

// ---------------------------------------------------------------------------
// Refresh (single-flight per role)
// ---------------------------------------------------------------------------
const refreshInFlight = new Map<Role, Promise<string | null>>();

const delay = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

/** Run one refresh at a time across every open tab, so two tabs never spend the same refresh token. */
const withRefreshLock = <T>(role: Role, task: () => Promise<T>): Promise<T> =>
  typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(`petal_pen_refresh_${role}`, task)
    : task();

/** POST the refresh token (cookie, plus the stored copy for browsers that block the cookie). */
const postRefresh = async (role: Role): Promise<Response> => {
  const refreshToken = tokenStore.getRefresh(role);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE_URL}${REFRESH_PATHS[role]}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
};

/**
 * Exchange the refresh token for a new access token. Resolves to the token, or null if it could not be renewed.
 * Only a 401/403 means the session is really over (the stored tokens are then cleared); after a network or
 * server hiccup the tokens are kept, so callers can tell the two apart with `tokenStore.get(role)`.
 */
export const refreshAccessToken = (role: Role): Promise<string | null> => {
  const existing = refreshInFlight.get(role);
  if (existing) return existing;

  const startedWith = tokenStore.get(role);
  const attempt = withRefreshLock(role, async (): Promise<string | null> => {
    try {
      // Another tab may have renewed the session while this one waited for the lock
      const current = tokenStore.get(role);
      if (current && current !== startedWith && isTokenFresh(current)) return current;

      let res = await postRefresh(role);
      if (res.status === 409) {
        // A parallel refresh won the race; its new token is in the cookie / storage by now
        await delay(REFRESH_CONFLICT_RETRY_MS);
        res = await postRefresh(role);
      }
      if (!res.ok) {
        // 401 = the refresh token is gone/expired/reused; anything else is a transient server problem
        if (res.status === 401 || res.status === 403) tokenStore.clear(role);
        return null;
      }
      const data = await res.json();
      if (typeof data.token !== 'string') return null;
      saveSessionTokens(role, data);
      return data.token;
    } catch {
      return null; // network hiccup (phone just woke up, offline, timeout): keep whatever tokens we have
    } finally {
      refreshInFlight.delete(role);
    }
  });

  refreshInFlight.set(role, attempt);
  return attempt;
};

/** Best-effort server-side logout (revokes the session), then forget the tokens locally. */
export const endServerSession = async (role: Role): Promise<void> => {
  const token = tokenStore.get(role);
  const refreshToken = tokenStore.getRefresh(role);
  try {
    await fetch(`${API_BASE_URL}${LOGOUT_PATHS[role]}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
  } catch {
    /* offline: the token is cleared below and the refresh cookie expires on its own */
  } finally {
    tokenStore.clear(role);
  }
};

// ---------------------------------------------------------------------------
// Response cache for public GETs
// ---------------------------------------------------------------------------
const getCache = new Map<string, { at: number; promise: Promise<Response> }>();

const invalidateCache = (): void => getCache.clear();

// ---------------------------------------------------------------------------
// authFetch: fetch() with auth, refresh-retry, 429 announcement and timeout
// ---------------------------------------------------------------------------
export interface AuthFetchInit extends RequestInit {
  /** Which session's token to send. Omit for public endpoints. */
  role?: Role;
  timeoutMs?: number;
  /** Reuse an identical GET for this long (also collapses concurrent duplicates). */
  cacheTtlMs?: number;
}

const send = async (url: string, init: AuthFetchInit, token: string | null): Promise<Response> => {
  const { role: _role, timeoutMs = DEFAULT_TIMEOUT_MS, cacheTtlMs: _ttl, signal: outerSignal, ...rest } = init;

  const headers = new Headers(rest.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', forwardAbort);

  try {
    return await fetch(url, { ...rest, headers, credentials: 'include', signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    outerSignal?.removeEventListener('abort', forwardAbort);
  }
};

const readCode = async (res: Response): Promise<string | undefined> => {
  try {
    return (await res.clone().json())?.code;
  } catch {
    return undefined;
  }
};

const perform = async (url: string, init: AuthFetchInit): Promise<Response> => {
  const { role } = init;
  let token = role ? tokenStore.get(role) : null;

  // Renew a token that is about to expire before it causes a 401
  if (role && token && !isTokenFresh(token)) {
    const renewed = await refreshAccessToken(role);
    if (renewed) token = renewed;
  }
  // The superadmin console: no access token in this tab (cleared by another tab, or an old tab) but the refresh cookie may
  // still be good. Renew first, so a save does not fail with a bare "Authentication required".
  if (role === 'superadmin' && !token) {
    token = await refreshAccessToken(role);
  }

  let res = await send(url, init, token);

  if (res.status === 401 && role) {
    const code = await readCode(res);
    if (code === 'AUTH_REQUIRED' && role === 'superadmin') {
      // The admin session is really gone: the console sends the admin back to the login page
      emitSessionEnded(role, 'expired');
      return res;
    }
    if (code === 'TOKEN_EXPIRED' && token) {
      const renewed = await refreshAccessToken(role);
      if (renewed) {
        res = await send(url, init, renewed);
      } else if (!tokenStore.get(role)) {
        // Refresh was refused: the session is really over. (A network hiccup keeps the tokens: just this request fails.)
        emitSessionEnded(role, 'expired');
      }
    } else if (code === 'TOKEN_REVOKED' || code === 'TOKEN_INVALID' || code === 'ACCOUNT_DISABLED') {
      emitSessionEnded(role, code === 'TOKEN_REVOKED' ? 'revoked' : code === 'ACCOUNT_DISABLED' ? 'deactivated' : 'invalid');
    }
  }

  if (res.status === 429) {
    const headerValue = Number(res.headers.get('Retry-After'));
    announceRateLimited(Number.isFinite(headerValue) && headerValue > 0 ? headerValue : 60);
    // Rate limit (429) is a temporary throttle, never end the user session or force-logout
  }

  return res;
};

export async function authFetch(url: string, init: AuthFetchInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();

  if (method !== 'GET') {
    // Any write may change what a cached GET would return
    invalidateCache();
    return perform(url, init);
  }

  const ttl = init.cacheTtlMs ?? 0;
  if (ttl <= 0) return perform(url, init);

  const key = `${init.role ?? 'public'}|${url}`;
  const cached = getCache.get(key);
  if (cached && Date.now() - cached.at < ttl) return (await cached.promise).clone();

  const promise = perform(url, init);
  getCache.set(key, { at: Date.now(), promise });
  try {
    const res = await promise;
    if (!res.ok) getCache.delete(key); // never cache failures (incl. 429)
    return res.clone();
  } catch (error) {
    getCache.delete(key);
    throw error;
  }
}

/** authFetch that always sends the superadmin token (when there is one). */
export const adminFetch = (url: string, init: AuthFetchInit = {}): Promise<Response> =>
  authFetch(url, { ...init, role: 'superadmin' });

// ---------------------------------------------------------------------------
// request(): JSON in, JSON out, ApiError on failure
// ---------------------------------------------------------------------------
export interface RequestOptions {
  method?: string;
  role?: Role;
  /** Object => JSON, FormData => multipart, undefined => no body. */
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Used when the server sends no message. */
  fallbackMessage?: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
}

const buildQuery = (query?: RequestOptions['query']): string => {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
};

export async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', role, body, query, fallbackMessage = 'Request failed', cacheTtlMs, timeoutMs } = options;

  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // the browser sets the multipart boundary itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}${path}${buildQuery(query)}`, { method, role, headers, body: payload, cacheTtlMs, timeoutMs });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    throw new ApiError(aborted ? 'The server took too long to respond. Please try again.' : 'Cannot reach the server. Check your connection.', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error || data?.message || fallbackMessage, res.status, data ?? {});
  }
  return data as T;
}
