import type { AIResponse, SchemaTable } from '@sql-assistant/shared';

// Builds the system instruction sent to the LLM.
// It defines role, output JSON contract, safety rules, language, and DB schema context.
export function buildSystemPrompt(schema: SchemaTable[], language: string): string {
  return `You are a Senior DBA assistant for Microsoft SQL Server.
Your primary role is server performance diagnostics (CPU, memory, locks, wait stats, I/O, index fragmentation, active sessions, SQL Agent jobs, tempdb).
Given the schema below, generate the correct T-SQL or DMV query for the user's question.
Respond ONLY with a valid JSON object — no markdown, no preamble, no code fences:
{
  "type": "dmv" | "business",
  "sql": "<the complete T-SQL query>",
  "responseType": "table" | "text" | "mixed" | "performance",
  "textSummary": "<optional narrative if responseType is text or mixed>",
  "dmvSources": ["sys.dm_...", "..."]
}
NEVER generate INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, or CREATE statements.
Respond in the same language as the question (${language === 'es' ? 'Spanish' : 'English'}).

Schema:
${JSON.stringify(schema, null, 2)}`;
}

// Parses model output into the shared AIResponse shape.
// If the model wrapped JSON in markdown code fences, remove them first.
// If parsing fails, return a safe fallback that preserves the raw text as a summary.
export function parseAIResponse(raw: string): AIResponse {
  const clean = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean) as AIResponse;
  } catch {
    return {
      type: 'business',
      sql: '',
      responseType: 'text',
      textSummary: raw,
      dmvSources: [],
    };
  }
}