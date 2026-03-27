import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import type { AIProviderConfig } from '@sql-assistant/shared';

export async function settingsRoutes(
  app: FastifyInstance,
  options: { db: Database }
): Promise<void> {
  const { db } = options;

  // GET current AI provider config
  app.get('/api/settings/ai-provider', async (): Promise<AIProviderConfig> => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return {
      ai_provider: (s.ai_provider as 'external' | 'local') ?? 'external',
      local_model: s.local_model ?? 'deepseek-coder',
      ollama_url: s.ollama_url ?? 'http://localhost:11434',
      anthropic_model: s.anthropic_model ?? 'claude-sonnet-4-5',
    };
  });

  // PUT update AI provider config
  app.put('/api/settings/ai-provider', async (req): Promise<{ ok: boolean }> => {
    const body = req.body as Partial<AIProviderConfig>;
    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    const updates: [string, string][] = [
      ['ai_provider', body.ai_provider ?? 'external'],
      ['local_model', body.local_model ?? 'deepseek-coder'],
      ['ollama_url', body.ollama_url ?? 'http://localhost:11434'],
      ['anthropic_model', body.anthropic_model ?? 'claude-sonnet-4-5'],
    ];
    const transaction = db.transaction(() => updates.forEach(([k, v]) => upsert.run(k, v)));
    transaction();
    return { ok: true };
  });

  // POST test Ollama connectivity
  app.post('/api/settings/test-ollama', async (req): Promise<{ ok: boolean; models?: string[]; error?: string }> => {
    const { ollama_url = 'http://localhost:11434' } = req.body as { ollama_url?: string };
    try {
      const res = await fetch(`${ollama_url}/api/tags`);
      const data = await res.json() as { models: { name: string }[] };
      return { ok: true, models: data.models?.map(m => m.name) ?? [] };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });
}