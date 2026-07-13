/** Fetch-based HTTP client mirroring the Angular app's auth interceptor:
 * attaches `Authorization: Bearer <accessToken>` to every non-/auth request,
 * refreshes once on 401, persists tokens in `localStorage['arbidex_auth']`
 * (with a memory fallback so Node smoke tests work). */

import { API_BASE_URL } from './config';

export interface StoredAuth {
  walletInfo: { address: string; provider: string };
  accessToken: string;
  refreshToken: string;
  userId: string;
}

const STORAGE_KEY = 'arbidex_auth';

// ── Token storage (localStorage or in-memory) ────────────────────────────────
let memoryAuth: StoredAuth | null = null;
const hasLocalStorage = (() => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
})();

export function getStoredAuth(): StoredAuth | null {
  if (hasLocalStorage) {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  }
  return memoryAuth;
}

export function setStoredAuth(auth: StoredAuth | null): void {
  if (hasLocalStorage) {
    if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    else localStorage.removeItem(STORAGE_KEY);
  } else {
    memoryAuth = auth;
  }
}

function base(): string {
  if (!API_BASE_URL) throw new Error('API_BASE_URL is not set (mock mode)');
  return API_BASE_URL.replace(/\/$/, '');
}

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const auth = getStoredAuth();
  if (!auth?.refreshToken) return null;
  const res = await fetch(`${base()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: auth.refreshToken }),
  });
  if (!res.ok) {
    setStoredAuth(null);
    return null;
  }
  const tokens = (await res.json()) as { accessToken: string; refreshToken: string };
  setStoredAuth({ ...auth, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  return tokens.accessToken;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Skip the Authorization header (auth endpoints). */
  noAuth?: boolean;
}

/** Perform an authenticated JSON request, retrying once after a token refresh. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(base() + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token && !opts.noAuth) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  };

  const token = opts.noAuth ? null : getStoredAuth()?.accessToken ?? null;
  let res = await send(token);

  if (res.status === 401 && !opts.noAuth) {
    if (!refreshing) refreshing = doRefresh().finally(() => (refreshing = null));
    const newToken = await refreshing;
    if (newToken) res = await send(newToken);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${opts.method ?? 'GET'} ${path} → ${res.status} ${res.statusText} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? await res.json() : (await res.text())) as T;
}
