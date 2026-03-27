import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import type { QueryResult } from '@sql-assistant/shared';
import { generateSQL } from '../services/aiProvider';
import { executeQuery } from '../services/sqlserver';
import { loadSchema } from '../services/schema';
import { decrypt } from '../utils/crypto';

export async function queryRoutes(
  app: FastifyInstance,
  options: { db: Database }
): Promise<void> {
  const { db } = options;

  app.post('/api/query', async (req, reply): Promise<QueryResult> => {
    const { question, connectionId, language = 'es' } = req.body as {
      question: string;
      connectionId: number;
      language?: string;
    };

    const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(connectionId) as
      | (Record<string, unknown> & { password_encrypted: Buffer }) | undefined;

    if (!conn) return reply.code(404).send({ error: 'Connection not found' });

    const password = decrypt(conn.password_encrypted);
    const connWithPassword = { ...conn, password } as never;

    const schema = await loadSchema(connWithPassword);

    const start = Date.now();
    const aiResult = await generateSQL({ question, schema, language, db });
    const rows = await executeQuery(connWithPassword, aiResult.sql);
    const durationMs = Date.now() - start;

    db.prepare(`
      INSERT INTO query_history
        (connection_id, question, generated_sql, query_type, response_type, duration_ms, row_count, language)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(connectionId, question, aiResult.sql, aiResult.type, aiResult.responseType, durationMs, rows.length, language);

    return {
      sql: aiResult.sql,
      queryType: aiResult.type,
      responseType: aiResult.responseType,
      textSummary: aiResult.textSummary,
      dmvSources: aiResult.dmvSources ?? [],
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows,
      durationMs,
    };
  });
}