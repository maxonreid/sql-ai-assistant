import sql from 'mssql';
import type { Connection, SchemaTable } from '@sql-assistant/shared';

export async function loadSchema(
  conn: Connection & { password: string }
): Promise<SchemaTable[]> {
  const pool = await sql.connect({
    server: conn.host,
    port: conn.port || 1433,
    database: conn.database_name,
    user: conn.username,
    password: conn.password,
    options: { encrypt: true, trustServerCertificate: true },
  });

  const result = await pool.request().query(`
    SELECT
      c.TABLE_NAME,
      c.COLUMN_NAME,
      c.DATA_TYPE,
      c.IS_NULLABLE,
      CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PK
    FROM INFORMATION_SCHEMA.COLUMNS c
    LEFT JOIN (
      SELECT ku.TABLE_NAME, ku.COLUMN_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
        ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
       AND tc.TABLE_NAME = ku.TABLE_NAME
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    ) pk ON c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
    ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
  `);

  await pool.close();

  const tables = new Map<string, SchemaTable>();

  for (const row of result.recordset) {
    if (!tables.has(row.TABLE_NAME)) {
      tables.set(row.TABLE_NAME, { name: row.TABLE_NAME, columns: [] });
    }
    tables.get(row.TABLE_NAME)!.columns.push({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === 'YES',
      isPrimaryKey: row.IS_PK === 1,
    });
  }

  return Array.from(tables.values());
}
