import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.SQLITE_PATH || './data/config.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
// Enable Write-Ahead Logging for better concurrency and crash resilience.
db.pragma('journal_mode = WAL');