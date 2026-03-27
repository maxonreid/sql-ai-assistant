// shared/types.ts
// Single source of truth for all data contracts between frontend and backend.

export type QueryType = 'dmv' | 'business';     // DMV are for DBAs , BUsiness is for data
export type ResponseType = 'table' | 'text' | 'mixed' | 'performance';
export type AIProviderType = 'external' | 'local';

export interface AIResponse {
  type: QueryType;
  sql: string;
  responseType: ResponseType;
  textSummary?: string;
  dmvSources?: string[];
}

export interface QueryResult {
  sql: string;
  queryType: QueryType;
  responseType: ResponseType;
  textSummary?: string;
  dmvSources: string[];
  columns: string[];
  rows: Record<string, unknown>[];
  durationMs: number;
}

export interface Connection {
  id: number;
  name: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  is_active: number;
  created_at: string;
  last_tested_at: string | null;
}

export interface AIProviderConfig {
  ai_provider: AIProviderType;
  local_model: string;
  ollama_url: string;
  anthropic_model: string;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}