// Backend base URL — configurable via NEXT_PUBLIC_API_URL, defaults to the
// local Fastify server. Works identically in dev (Next.js) and production
// (Electron file://) because both load the UI from the same machine.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

export const apiUrl = (path: string) => `${BASE}${path}`;

// ── Session token helpers ─────────────────────────────────────────────────────

const TOKEN_KEY  = 'sql-assistant:token';
const AUTHED_KEY = 'sql-assistant:authed';

export const getToken  = (): string | null => sessionStorage.getItem(TOKEN_KEY);
export const setToken  = (token: string): void => sessionStorage.setItem(TOKEN_KEY, token);

export const clearSession = (): void => {
  const token = getToken();
  if (token) {
    // Revoke on the backend — fire-and-forget, don't block navigation
    fetch(apiUrl('/api/auth/logout'), {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(AUTHED_KEY);
};

// ── Authenticated fetch wrapper ───────────────────────────────────────────────
// Drop-in replacement for fetch(apiUrl(path), init) on protected routes.
// Automatically injects the Authorization header when a token is present.

export const apiFetch = (path: string, init?: RequestInit): Promise<Response> => {
  const token = getToken();
  return fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};
