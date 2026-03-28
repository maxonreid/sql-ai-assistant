import { randomUUID } from 'crypto';

const sessions = new Map<string, number>(); // token → expiresAt (ms)
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours — covers a full work day

export function issueToken(): string {
  const token = randomUUID();
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function isValidToken(token: string): boolean {
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { sessions.delete(token); return false; }
  return true;
}

export function revokeToken(token: string): void {
  sessions.delete(token);
}

/** For tests only — clears all active sessions. */
export function _clearAllSessionsForTests(): void {
  sessions.clear();
}
