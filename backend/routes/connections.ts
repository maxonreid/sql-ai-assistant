import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import type { Connection } from '@sql-assistant/shared';
import { encrypt, decrypt } from '../utils/crypto';
import { executeQuery } from '../services/sqlserver';

type ConnectionRow = Connection & { password_encrypted: Buffer };

const SELECT_COLS = 'id, name, host, port, database_name, username, is_active, created_at, last_tested_at';

export async function connectionRoutes(
  app: FastifyInstance,
  options: { db: Database }
): Promise<void> {
  const { db } = options;

  app.get('/api/connections', async (): Promise<Connection[]> => {
    return db.prepare(`SELECT ${SELECT_COLS} FROM connections ORDER BY created_at DESC`).all() as Connection[];
  });

  app.post('/api/connections', async (req): Promise<Connection> => {
    const { name, host, port = 1433, database_name, username, password } = req.body as {
      name: string; host: string; port?: number;
      database_name: string; username: string; password: string;
    };
    const password_encrypted = encrypt(password);
    const result = db.prepare(`
      INSERT INTO connections (name, host, port, database_name, username, password_encrypted)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, host, port, database_name, username, password_encrypted);
    return db.prepare(`SELECT ${SELECT_COLS} FROM connections WHERE id = ?`).get(result.lastInsertRowid) as Connection;
  });

  app.put('/api/connections/:id', async (req, reply): Promise<Connection> => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<Connection & { password: string }>;
    const existing = db.prepare('SELECT * FROM connections WHERE id = ?').get(Number(id)) as ConnectionRow | undefined;
    if (!existing) return reply.code(404).send({ error: 'Connection not found' });

    const password_encrypted = body.password ? encrypt(body.password) : existing.password_encrypted;
    db.prepare(`
      UPDATE connections
      SET name = ?, host = ?, port = ?, database_name = ?, username = ?, password_encrypted = ?
      WHERE id = ?
    `).run(
      body.name ?? existing.name,
      body.host ?? existing.host,
      body.port ?? existing.port,
      body.database_name ?? existing.database_name,
      body.username ?? existing.username,
      password_encrypted,
      Number(id)
    );
    return db.prepare(`SELECT ${SELECT_COLS} FROM connections WHERE id = ?`).get(Number(id)) as Connection;
  });

  app.delete('/api/connections/:id', async (req, reply): Promise<{ ok: boolean }> => {
    const { id } = req.params as { id: string };
    const result = db.prepare('DELETE FROM connections WHERE id = ?').run(Number(id));
    if (result.changes === 0) return reply.code(404).send({ error: 'Connection not found' });
    return { ok: true };
  });

  app.post('/api/connections/:id/test', async (req, reply): Promise<{ ok: boolean; error?: string }> => {
    const { id } = req.params as { id: string };
    const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(Number(id)) as ConnectionRow | undefined;
    if (!conn) return reply.code(404).send({ error: 'Connection not found' });
    try {
      const password = decrypt(conn.password_encrypted);
      await executeQuery({ ...conn, password } as never, 'SELECT 1');
      db.prepare("UPDATE connections SET last_tested_at = datetime('now'), is_active = 1 WHERE id = ?").run(Number(id));
      return { ok: true };
    } catch (err) {
      db.prepare('UPDATE connections SET is_active = 0 WHERE id = ?').run(Number(id));
      return { ok: false, error: (err as Error).message };
    }
  });
}
