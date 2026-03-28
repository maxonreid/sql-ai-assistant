import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { issueToken, isValidToken, revokeToken, _clearAllSessionsForTests } from '../../utils/session';

beforeEach(() => _clearAllSessionsForTests());

describe('session utils', () => {
  it('issueToken returns a non-empty string', () => {
    expect(typeof issueToken()).toBe('string');
    expect(issueToken().length).toBeGreaterThan(0);
  });

  it('a freshly issued token is valid', () => {
    const token = issueToken();
    expect(isValidToken(token)).toBe(true);
  });

  it('an unknown token is invalid', () => {
    expect(isValidToken('not-a-real-token')).toBe(false);
  });

  it('a revoked token is invalid', () => {
    const token = issueToken();
    revokeToken(token);
    expect(isValidToken(token)).toBe(false);
  });

  it('an expired token is invalid', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const token = issueToken();
    vi.setSystemTime(now + 9 * 60 * 60 * 1000); // advance 9 hours past 8-hour TTL
    expect(isValidToken(token)).toBe(false);
    vi.useRealTimers();
  });

  it('multiple tokens can be active simultaneously', () => {
    const a = issueToken();
    const b = issueToken();
    expect(isValidToken(a)).toBe(true);
    expect(isValidToken(b)).toBe(true);
    revokeToken(a);
    expect(isValidToken(a)).toBe(false);
    expect(isValidToken(b)).toBe(true);
  });
});
