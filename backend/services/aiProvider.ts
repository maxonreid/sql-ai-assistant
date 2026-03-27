import type { AIResponse, AIProviderConfig, SchemaTable } from '@sql-assistant/shared';
import type { Database } from 'better-sqlite3';
import { ClaudeProvider } from './claudeProvider';
import { OllamaProvider } from './ollamaProvider';
import { buildSystemPrompt } from './promptBuilder';

// Shared contract implemented by each AI backend.
export interface AIProvider {
  generateSQL(args: {
    question: string;
    schema: SchemaTable[];
    language: string;
  }): Promise<AIResponse>;
}

// Main orchestration entrypoint: reads provider settings, selects the backend,
// then delegates SQL generation to the selected provider implementation.
export async function generateSQL(args: {
  question: string;
  schema: SchemaTable[];
  language: string;
  db: Database;
}): Promise<AIResponse> {
  const { question, schema, language, db } = args;

  const config = getProviderConfig(db);
  const systemPrompt = buildSystemPrompt(schema, language);

  // Switch between local (Ollama) and external (Claude) providers at runtime.
  const provider: AIProvider =
    config.ai_provider === 'local'
      ? new OllamaProvider(config)
      : new ClaudeProvider(config);

  // Provider handles model-specific prompt wiring and response parsing.
  return provider.generateSQL({ question, schema, language });
}

// Loads persisted settings from the SQLite `settings` table and applies
// safe defaults so the app can run even before explicit configuration.
function getProviderConfig(db: Database): AIProviderConfig {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  // Convert [{ key, value }, ...] into { key: value, ... } for easy access.
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    ai_provider: (s.ai_provider as 'external' | 'local') ?? 'external',
    local_model: s.local_model ?? 'deepseek-coder',
    ollama_url: s.ollama_url ?? 'http://localhost:11434',
    anthropic_model: s.anthropic_model ?? 'claude-sonnet-4-5',
  };
}