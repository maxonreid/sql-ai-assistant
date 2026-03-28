import { describe, it, expect, vi } from 'vitest';

// Mock mssql so tests never open a real network connection
vi.mock('mssql', () => ({
  default: {
    connect: vi.fn().mockResolvedValue({
      request: () => ({ query: vi.fn().mockResolvedValue({ recordset: [] }) }),
      close:   vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

const { executeQuery } = await import('../../services/sqlserver');

const conn = {
  id: 1, name: 'test', host: 'localhost', port: 1433,
  database_name: 'TestDB', username: 'sa', password: 'pass',
  is_active: 1, created_at: '', last_tested_at: null,
};

describe('executeQuery — read-only guard', () => {
  const blocked = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'EXEC', 'EXECUTE'];

  for (const keyword of blocked) {
    it(`blocks ${keyword} statements`, async () => {
      await expect(executeQuery(conn, `${keyword} INTO foo VALUES (1)`))
        .rejects.toThrow('read-only');
    });
  }

  it('blocks keywords case-insensitively', async () => {
    await expect(executeQuery(conn, 'insert into foo values (1)'))
      .rejects.toThrow('read-only');
  });

  it('allows SELECT queries through to the mock pool', async () => {
    const rows = await executeQuery(conn, 'SELECT 1 AS n');
    expect(Array.isArray(rows)).toBe(true);
  });
});
