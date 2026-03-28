import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/** Creates an in-memory SQLite database with all migrations applied. */
export function createTestDb(): InstanceType<typeof Database> {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  const migrationsDir = path.join(__dirname, '../db/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
  }

  return db;
}

/** The 64-char hex key used across all tests that touch crypto. */
export const TEST_ENCRYPTION_KEY = 'a'.repeat(64);
