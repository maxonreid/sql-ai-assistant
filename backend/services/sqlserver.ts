import sql from 'mssql';
import type { Connection } from '@sql-assistant/shared';

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|EXEC|EXECUTE)\b/i;

async function getPool(conn: Connection & { password: string }): Promise<sql.ConnectionPool> {
  return sql.connect({
    server: conn.host,
    port: conn.port || 1433,
    database: conn.database_name,
    user: conn.username,
    password: conn.password,
    options: { encrypt: true, trustServerCertificate: true },
  });
}

export async function executeQuery(
  conn: Connection & { password: string },
  queryText: string
): Promise<Record<string, unknown>[]> {
  if (FORBIDDEN.test(queryText)) {
    throw new Error('Mutation query blocked by read-only policy');
  }
  const pool = await getPool(conn);
  const result = await pool.request().query(queryText);
  await pool.close();
  return result.recordset as Record<string, unknown>[];
}