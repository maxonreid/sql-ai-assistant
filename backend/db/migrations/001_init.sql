CREATE TABLE IF NOT EXISTS connections (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  host              TEXT NOT NULL,
  port              INTEGER DEFAULT 1433,
  database_name     TEXT NOT NULL,
  username          TEXT NOT NULL,
  password_encrypted BLOB,
  is_active         INTEGER DEFAULT 0,
  created_at        TEXT DEFAULT (datetime('now')),
  last_tested_at    TEXT
);

CREATE TABLE IF NOT EXISTS query_history (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id  INTEGER REFERENCES connections(id),
  question       TEXT,
  generated_sql  TEXT,
  query_type     TEXT,
  response_type  TEXT,
  duration_ms    INTEGER,
  row_count      INTEGER,
  created_at     TEXT DEFAULT (datetime('now')),
  language       TEXT DEFAULT 'es'
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('language', 'es'),
  ('anthropic_model', 'claude-sonnet-4-5'),
  ('schema_cache_ttl_min', '10');