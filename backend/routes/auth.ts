import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { generateSecret, verify as totpVerify } from 'otplib';
import QRCode from 'qrcode';
import { encrypt, decrypt } from '../utils/crypto';
import { issueToken, revokeToken } from '../utils/session';

// In-memory rate limiter — single-user desktop app, no persistence needed.
const rl = { failCount: 0, lockedUntil: 0 };
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 5 * 60 * 1000; // 5 minutes

/** For tests only — resets rate-limiter state between test cases. */
export function _resetRateLimiterForTests(): void {
  rl.failCount   = 0;
  rl.lockedUntil = 0;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStoredSecret(db: Database): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'totp_secret_encrypted'").get() as
    | { value: string } | undefined;
  if (!row?.value) return null;
  return decrypt(Buffer.from(row.value, 'base64'));
}

function storeSecret(db: Database, secret: string): void {
  const encrypted = encrypt(secret).toString('base64');
  db.prepare("UPDATE settings SET value = ? WHERE key = 'totp_secret_encrypted'").run(encrypted);
}

function isSetupDone(db: Database): boolean {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'totp_setup_done'").get() as
    | { value: string } | undefined;
  return row?.value === '1';
}

// ── Route registration ────────────────────────────────────────────────────────

export async function authRoutes(
  app: FastifyInstance,
  options: { db: Database }
): Promise<void> {
  const { db } = options;

  // GET /api/auth/status — tells the frontend whether first-run setup is needed
  app.get('/api/auth/status', async (): Promise<{ setupRequired: boolean }> => {
    return { setupRequired: !isSetupDone(db) };
  });

  // GET /api/auth/setup — generates (once) and returns the QR code data URL
  app.get('/api/auth/setup', async (req, reply): Promise<{ qrDataUrl: string }> => {
    if (isSetupDone(db)) {
      return reply.code(409).send({ error: 'Setup already completed' });
    }

    // Reuse existing secret if the page is revisited before confirmation
    let secret = getStoredSecret(db);
    if (!secret) {
      secret = generateSecret();
      storeSecret(db, secret);
    }

    const uri = `otpauth://totp/SQL%20Assistant:DBA?secret=${secret}&issuer=SQL%20Assistant&algorithm=SHA1&digits=6&period=30`;
    const qrDataUrl = await QRCode.toDataURL(uri, { width: 200 });

    return { qrDataUrl };
  });

  // POST /api/auth/setup/confirm — verifies first code and marks setup complete
  app.post('/api/auth/setup/confirm', async (req, reply): Promise<{ ok: boolean; error?: string }> => {
    if (isSetupDone(db)) {
      return reply.code(409).send({ ok: false, error: 'Setup already completed' });
    }

    const now = Date.now();
    if (rl.lockedUntil > now) {
      return reply.code(429).send({ ok: false, error: 'locked', lockedUntil: rl.lockedUntil });
    }

    const { token } = req.body as { token: string };
    const secret = getStoredSecret(db);
    if (!secret) return reply.code(400).send({ ok: false, error: 'Setup not initialised — visit /api/auth/setup first' });

    const { valid: isValid } = await totpVerify({ token, secret, type: 'totp' });

    if (!isValid) {
      rl.failCount += 1;
      if (rl.failCount >= MAX_ATTEMPTS) {
        rl.lockedUntil = Date.now() + LOCKOUT_MS;
        rl.failCount   = 0;
        return reply.code(429).send({ ok: false, error: 'locked', lockedUntil: rl.lockedUntil });
      }
      return reply.code(401).send({ ok: false, error: 'Invalid or expired code' });
    }

    db.prepare("UPDATE settings SET value = '1' WHERE key = 'totp_setup_done'").run();
    rl.failCount   = 0;
    rl.lockedUntil = 0;
    return { ok: true };
  });

  // POST /api/auth/verify — regular login (requires setup to have been completed)
  app.post('/api/auth/verify', async (req, reply): Promise<{ ok: boolean; token?: string; error?: string; lockedUntil?: number }> => {
    if (!isSetupDone(db)) {
      return reply.code(403).send({ ok: false, error: 'setup_required' });
    }

    const now = Date.now();
    if (rl.lockedUntil > now) {
      return reply.code(429).send({ ok: false, error: 'locked', lockedUntil: rl.lockedUntil });
    }

    const { token } = req.body as { token: string };
    const secret = getStoredSecret(db);
    if (!secret) return reply.code(500).send({ ok: false, error: 'TOTP secret not found' });

    const { valid: isValid } = await totpVerify({ token, secret, type: 'totp' });

    if (!isValid) {
      rl.failCount += 1;
      if (rl.failCount >= MAX_ATTEMPTS) {
        rl.lockedUntil = Date.now() + LOCKOUT_MS;
        rl.failCount   = 0;
        return reply.code(429).send({ ok: false, error: 'locked', lockedUntil: rl.lockedUntil });
      }
      return reply.code(401).send({ ok: false, error: 'Invalid or expired code' });
    }

    rl.failCount   = 0;
    rl.lockedUntil = 0;
    return { ok: true, token: issueToken() };
  });

  // POST /api/auth/logout — invalidate the session token
  app.post('/api/auth/logout', async (req): Promise<{ ok: boolean }> => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) revokeToken(auth.slice(7));
    return { ok: true };
  });
}
