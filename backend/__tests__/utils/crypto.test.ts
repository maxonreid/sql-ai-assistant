import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { TEST_ENCRYPTION_KEY } from '../helpers';

beforeAll(() => { vi.stubEnv('ENCRYPTION_KEY', TEST_ENCRYPTION_KEY); });
afterAll(()  => { vi.unstubAllEnvs(); });

// Import after env is set so getKey() succeeds
const { encrypt, decrypt } = await import('../../utils/crypto');

describe('crypto utils', () => {
  it('round-trips plaintext through encrypt → decrypt', () => {
    const plain = 'super-secret-password!';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('round-trips unicode strings', () => {
    const plain = '🔐 contraseña con ñ y émojis';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('produces a different ciphertext on every call (random IV)', () => {
    const plain = 'same-input';
    expect(encrypt(plain).toString('base64')).not.toBe(encrypt(plain).toString('base64'));
  });

  it('decrypt treats a buffer without the version byte as legacy plaintext', () => {
    const legacy = Buffer.from('plaintext-password', 'utf8');
    expect(decrypt(legacy)).toBe('plaintext-password');
  });

  it('throws when ENCRYPTION_KEY is not set', async () => {
    vi.stubEnv('ENCRYPTION_KEY', '');
    // Re-import to get a fresh module that reads the missing env
    const { encrypt: enc } = await import('../../utils/crypto');
    expect(() => enc('x')).toThrow('ENCRYPTION_KEY');
    vi.stubEnv('ENCRYPTION_KEY', TEST_ENCRYPTION_KEY);
  });

  it('throws when ENCRYPTION_KEY is the wrong length', () => {
    vi.stubEnv('ENCRYPTION_KEY', 'tooshort');
    expect(() => encrypt('x')).toThrow('64-character');
    vi.stubEnv('ENCRYPTION_KEY', TEST_ENCRYPTION_KEY);
  });
});
