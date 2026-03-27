import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const VERSION = 0x01;
const IV_LEN = 12;   // GCM recommended IV length
const TAG_LEN = 16;  // GCM auth tag length

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY environment variable is required');
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(raw, 'hex');
}

// Stored format: [0x01 | iv(12) | authTag(16) | ciphertext]
export function encrypt(plaintext: string): Buffer {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, authTag, ciphertext]);
}

export function decrypt(data: Buffer): string {
  // Backward compat: legacy rows have no version byte — treat as plaintext
  if (data[0] !== VERSION) return data.toString('utf8');

  const key = getKey();
  const iv = data.subarray(1, 1 + IV_LEN);
  const authTag = data.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ciphertext = data.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}
