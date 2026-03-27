import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import type { Connection, SchemaTable } from '@sql-assistant/shared';
import { loadSchema } from '../services/schema';
import { decrypt } from '../utils/crypto';

type ConnectionRow = Connection & { password_encrypted: Buffer };

const schemaCache = new Map<number, { tables: SchemaTable[]; fetchedAt: number }>();

export async function schemaRoutes(
  app: FastifyInstance,
  options: { db: Database }
): Promise<void> {
  const { db } = options;

  function getCacheTtlMs(): number {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('schema_cache_ttl_min') as { value: string } | undefined;
    return Number(row?.value ?? 10) * 60_000;
  }

  app.get('/api/schema/:connectionId', async (req, reply): Promise<SchemaTable[]> => {
    const { connectionId } = req.params as { connectionId: string };
    const id = Number(connectionId);
    const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as ConnectionRow | undefined;
    if (!conn) return reply.code(404).send({ error: 'Connection not found' });

    const cached = schemaCache.get(id);
    if (cached && Date.now() - cached.fetchedAt < getCacheTtlMs()) {
      return cached.tables;
    }

    const password = decrypt(conn.password_encrypted);
    const tables = await loadSchema({ ...conn, password });
    schemaCache.set(id, { tables, fetchedAt: Date.now() });
    return tables;
  });

  app.delete('/api/schema/:connectionId/cache', async (req): Promise<{ ok: boolean }> => {
    const { connectionId } = req.params as { connectionId: string };
    schemaCache.delete(Number(connectionId));
    return { ok: true };
  });
}
