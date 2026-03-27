import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.SQLITE_PATH || './data/config.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Track applied migrations in a schema_migrations table.
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    filename   TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const applied = new Set(
  (db.prepare('SELECT filename FROM schema_migrations').all() as { filename: string }[])
    .map(r => r.filename)
);

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort(); // lexicographic order: 001_, 002_, …

let ran = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`  skip  ${file}`);
    continue;
  }

  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

  db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file);
  })();

  console.log(`  apply ${file}`);
  ran++;
}

console.log(ran === 0 ? 'Already up to date.' : `${ran} migration(s) applied.`);
db.close();
