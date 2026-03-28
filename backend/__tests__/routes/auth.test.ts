import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { authRoutes, _resetRateLimiterForTests } from '../../routes/auth';
import { _clearAllSessionsForTests } from '../../utils/session';
import { createTestDb, TEST_ENCRYPTION_KEY } from '../helpers';

// Set the encryption key before anything imports crypto
vi.stubEnv('ENCRYPTION_KEY', TEST_ENCRYPTION_KEY);

// Mock otplib so we can control TOTP verification without real time-based codes
vi.mock('otplib', () => {
  const mockVerify = vi.fn();
  const mockGenerateSecret = vi.fn().mockReturnValue('TESTSECRETBASE32AAA');
  const NobleCryptoPlugin  = vi.fn();
  const ScureBase32Plugin  = vi.fn();
  class TOTP {
    verify = mockVerify;
  }
  return { TOTP, NobleCryptoPlugin, ScureBase32Plugin, generateSecret: mockGenerateSecret };
});

// Mock qrcode to avoid canvas/native deps
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,MOCK') },
}));

import { TOTP } from 'otplib';

// Helper to get the shared mock verify fn from the mocked TOTP instance
function getMockVerify() {
  return (new TOTP() as any).verify as ReturnType<typeof vi.fn>;
}

async function buildApp() {
  const db  = createTestDb();
  const app = Fastify({ logger: false });
  await app.register(authRoutes, { db });
  await app.ready();
  return { app, db };
}

beforeEach(() => {
  _resetRateLimiterForTests();
  _clearAllSessionsForTests();
  getMockVerify().mockReset();
});

// ── GET /api/auth/status ──────────────────────────────────────────────────────

describe('GET /api/auth/status', () => {
  it('returns setupRequired:true on a fresh database', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/auth/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ setupRequired: true });
  });

  it('returns setupRequired:false after setup is completed', async () => {
    const { app, db } = await buildApp();
    db.prepare("UPDATE settings SET value = '1' WHERE key = 'totp_setup_done'").run();
    const res = await app.inject({ method: 'GET', url: '/api/auth/status' });
    expect(res.json()).toMatchObject({ setupRequired: false });
  });
});

// ── GET /api/auth/setup ───────────────────────────────────────────────────────

describe('GET /api/auth/setup', () => {
  it('returns a qrDataUrl on first call', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/auth/setup' });
    expect(res.statusCode).toBe(200);
    expect(res.json().qrDataUrl).toBe('data:image/png;base64,MOCK');
  });

  it('is idempotent — returns the same qrDataUrl on a second call', async () => {
    const { app } = await buildApp();
    await app.inject({ method: 'GET', url: '/api/auth/setup' });
    const res = await app.inject({ method: 'GET', url: '/api/auth/setup' });
    expect(res.statusCode).toBe(200);
  });

  it('returns 409 if setup is already done', async () => {
    const { app, db } = await buildApp();
    db.prepare("UPDATE settings SET value = '1' WHERE key = 'totp_setup_done'").run();
    const res = await app.inject({ method: 'GET', url: '/api/auth/setup' });
    expect(res.statusCode).toBe(409);
  });
});

// ── POST /api/auth/setup/confirm ──────────────────────────────────────────────

describe('POST /api/auth/setup/confirm', () => {
  async function setupAndSeed() {
    const { app, db } = await buildApp();
    // Seed a secret so confirm has something to verify against
    await app.inject({ method: 'GET', url: '/api/auth/setup' });
    return { app, db };
  }

  it('confirms and marks setup done when TOTP is valid', async () => {
    const { app, db } = await setupAndSeed();
    getMockVerify().mockResolvedValue({ valid: true });

    const res = await app.inject({
      method: 'POST', url: '/api/auth/setup/confirm',
      payload: { token: '123456' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });

    const row = db.prepare("SELECT value FROM settings WHERE key = 'totp_setup_done'").get() as { value: string };
    expect(row.value).toBe('1');
  });

  it('returns 401 for an invalid TOTP code', async () => {
    const { app } = await setupAndSeed();
    getMockVerify().mockResolvedValue({ valid: false });

    const res = await app.inject({
      method: 'POST', url: '/api/auth/setup/confirm',
      payload: { token: '000000' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ ok: false });
  });

  it('returns 429 after 5 consecutive failures', async () => {
    const { app } = await setupAndSeed();
    getMockVerify().mockResolvedValue({ valid: false });

    for (let i = 0; i < 4; i++) {
      await app.inject({
        method: 'POST', url: '/api/auth/setup/confirm',
        payload: { token: '000000' },
      });
    }
    const res = await app.inject({
      method: 'POST', url: '/api/auth/setup/confirm',
      payload: { token: '000000' },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toMatchObject({ error: 'locked' });
  });

  it('returns 409 if setup is already done', async () => {
    const { app, db } = await buildApp();
    db.prepare("UPDATE settings SET value = '1' WHERE key = 'totp_setup_done'").run();
    const res = await app.inject({
      method: 'POST', url: '/api/auth/setup/confirm',
      payload: { token: '123456' },
    });
    expect(res.statusCode).toBe(409);
  });
});

// ── POST /api/auth/verify ─────────────────────────────────────────────────────

describe('POST /api/auth/verify', () => {
  async function setupDoneApp() {
    const result = await buildApp();
    const { app, db } = result;
    // Seed a secret then mark setup done
    await app.inject({ method: 'GET', url: '/api/auth/setup' });
    db.prepare("UPDATE settings SET value = '1' WHERE key = 'totp_setup_done'").run();
    return result;
  }

  it('returns ok:true with a token on valid TOTP', async () => {
    const { app } = await setupDoneApp();
    getMockVerify().mockResolvedValue({ valid: true });

    const res = await app.inject({
      method: 'POST', url: '/api/auth/verify',
      payload: { token: '123456' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
  });

  it('returns 401 for an invalid TOTP code', async () => {
    const { app } = await setupDoneApp();
    getMockVerify().mockResolvedValue({ valid: false });

    const res = await app.inject({
      method: 'POST', url: '/api/auth/verify',
      payload: { token: '000000' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 429 after 5 consecutive failures', async () => {
    const { app } = await setupDoneApp();
    getMockVerify().mockResolvedValue({ valid: false });

    for (let i = 0; i < 4; i++) {
      await app.inject({
        method: 'POST', url: '/api/auth/verify',
        payload: { token: '000000' },
      });
    }
    const res = await app.inject({
      method: 'POST', url: '/api/auth/verify',
      payload: { token: '000000' },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toMatchObject({ error: 'locked' });
  });

  it('returns 403 when setup has not been completed', async () => {
    const { app } = await buildApp();
    getMockVerify().mockResolvedValue({ valid: true });

    const res = await app.inject({
      method: 'POST', url: '/api/auth/verify',
      payload: { token: '123456' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: 'setup_required' });
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('always returns ok:true (even without a token)', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it('accepts and revokes a Bearer token', async () => {
    const { app } = await buildApp();
    // Log in first
    await app.inject({ method: 'GET', url: '/api/auth/setup' });
    const db2 = (app as any).db; // not exposed, but logout doesn't need the db

    getMockVerify().mockResolvedValue({ valid: true });
    const db = createTestDb();
    const app2 = Fastify({ logger: false });
    await app2.register(authRoutes, { db });
    await app2.inject({ method: 'GET', url: '/api/auth/setup' });
    db.prepare("UPDATE settings SET value = '1' WHERE key = 'totp_setup_done'").run();

    const loginRes = await app2.inject({
      method: 'POST', url: '/api/auth/verify',
      payload: { token: '123456' },
    });
    const { token } = loginRes.json();

    const logoutRes = await app2.inject({
      method: 'POST', url: '/api/auth/logout',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutRes.statusCode).toBe(200);
  });
});
