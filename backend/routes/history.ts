import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import type { HistoryItem } from '@sql-assistant/shared';

export async function historyRoutes(
  app: FastifyInstance,
  options: { db: Database }
): Promise<void> {
  const { db } = options;

  // GET /api/history?connectionId=1&limit=50
  app.get('/api/history', async (req): Promise<HistoryItem[]> => {
    const { connectionId, limit = '50' } = req.query as {
      connectionId?: string;
      limit?: string;
    };

    const cap = Math.min(Math.max(1, Number(limit) || 50), 200);

    if (connectionId) {
      return db
        .prepare(
          'SELECT * FROM query_history WHERE connection_id = ? ORDER BY created_at DESC LIMIT ?'
        )
        .all(Number(connectionId), cap) as HistoryItem[];
    }

    return db
      .prepare('SELECT * FROM query_history ORDER BY created_at DESC LIMIT ?')
      .all(cap) as HistoryItem[];
  });
}
