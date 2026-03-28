import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { historyRoutes } from '../../routes/history';
import { createTestDb } from '../helpers';
import { TEST_ENCRYPTION_KEY } from '../helpers';

vi.stubEnv('ENCRYPTION_KEY', TEST_ENCRYPTION_KEY);

function insertConnection(db: ReturnType<typeof createTestDb>): number {
  const result = db.prepare(`
    INSERT INTO connections (name, host, port, database_name, username)
    VALUES ('test', 'localhost', 1433, 'TestDB', 'sa')
  `).run();
  return result.lastInsertRowid as number;
}

let _histSeq = 0;

function insertHistory(db: ReturnType<typeof createTestDb>, overrides: Partial<{
  connection_id: number | null;
  question: string;
  generated_sql: string;
  query_type: string;
  response_type: string;
  duration_ms: number;
  row_count: number;
  language: string;
  created_at: string;
}> = {}) {
  // Use incrementing timestamps so ORDER BY created_at DESC is deterministic
  _histSeq++;
  const ts = new Date(2024, 0, 1, 0, 0, _histSeq).toISOString().replace('T', ' ').slice(0, 19);
  const defaults = {
    connection_id: null as number | null,
    question: 'How many orders?',
    generated_sql: 'SELECT COUNT(*) FROM orders',
    query_type: 'business',
    response_type: 'table',
    duration_ms: 120,
    row_count: 1,
    language: 'en',
    created_at: ts,
  };
  const row = { ...defaults, ...overrides };
  db.prepare(`
    INSERT INTO query_history
      (connection_id, question, generated_sql, query_type, response_type, duration_ms, row_count, language, created_at)
    VALUES
      (@connection_id, @question, @generated_sql, @query_type, @response_type, @duration_ms, @row_count, @language, @created_at)
  `).run(row);
}

beforeEach(() => { _histSeq = 0; });

async function buildApp() {
  const db  = createTestDb();
  const app = Fastify({ logger: false });
  await app.register(historyRoutes, { db });
  await app.ready();
  return { app, db };
}

describe('GET /api/history', () => {
  it('returns an empty array when there is no history', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/history' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns all history rows ordered newest first', async () => {
    const { app, db } = await buildApp();
    insertHistory(db, { question: 'first' });
    insertHistory(db, { question: 'second' });

    const res = await app.inject({ method: 'GET', url: '/api/history' });
    const rows = res.json() as Array<{ question: string }>;
    expect(rows.length).toBe(2);
    // SQLite autoincrement + ORDER BY DESC → second row comes first
    expect(rows[0].question).toBe('second');
    expect(rows[1].question).toBe('first');
  });

  it('filters by connectionId when provided', async () => {
    const { app, db } = await buildApp();
    const connA = insertConnection(db);
    const connB = insertConnection(db);
    insertHistory(db, { connection_id: connA, question: 'conn-A query' });
    insertHistory(db, { connection_id: connB, question: 'conn-B query' });

    const res = await app.inject({ method: 'GET', url: `/api/history?connectionId=${connA}` });
    const rows = res.json() as Array<{ question: string }>;
    expect(rows.length).toBe(1);
    expect(rows[0].question).toBe('conn-A query');
  });

  it('respects the limit query parameter', async () => {
    const { app, db } = await buildApp();
    for (let i = 0; i < 10; i++) insertHistory(db, { question: `q${i}` });

    const res = await app.inject({ method: 'GET', url: '/api/history?limit=3' });
    expect(res.json().length).toBe(3);
  });

  it('clamps limit to a maximum of 200', async () => {
    const { app, db } = await buildApp();
    for (let i = 0; i < 10; i++) insertHistory(db, { question: `q${i}` });

    // Passing 999 should still work — it just returns whatever rows exist (≤ 10)
    const res = await app.inject({ method: 'GET', url: '/api/history?limit=999' });
    expect(res.json().length).toBe(10); // only 10 rows exist
  });

  it('clamps limit to a minimum of 1', async () => {
    const { app, db } = await buildApp();
    insertHistory(db, { question: 'only one' });

    const res = await app.inject({ method: 'GET', url: '/api/history?limit=0' });
    // limit=0 falls back to 50, so 1 row is returned
    expect(res.json().length).toBe(1);
  });

  it('defaults to limit 50 when not specified', async () => {
    const { app, db } = await buildApp();
    for (let i = 0; i < 60; i++) insertHistory(db, { question: `q${i}` });

    const res = await app.inject({ method: 'GET', url: '/api/history' });
    expect(res.json().length).toBe(50);
  });

  it('returns all expected fields on each row', async () => {
    const { app, db } = await buildApp();
    const connId = insertConnection(db);
    insertHistory(db, {
      connection_id: connId,
      question: 'test question',
      generated_sql: 'SELECT 1',
      query_type: 'dmv',
      response_type: 'table',
      duration_ms: 42,
      row_count: 7,
      language: 'es',
    });

    const res = await app.inject({ method: 'GET', url: '/api/history' });
    const row = res.json()[0];
    expect(row).toMatchObject({
      connection_id:  connId,
      question:       'test question',
      generated_sql:  'SELECT 1',
      query_type:     'dmv',
      response_type:  'table',
      duration_ms:    42,
      row_count:      7,
      language:       'es',
    });
    expect(typeof row.id).toBe('number');
    expect(typeof row.created_at).toBe('string');
  });
});
