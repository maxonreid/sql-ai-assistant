import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, parseAIResponse } from '../../services/promptBuilder';
import type { SchemaTable } from '@sql-assistant/shared';

const schema: SchemaTable[] = [
  {
    name: 'Orders',
    columns: [
      { name: 'id',         type: 'int',     nullable: false, isPrimaryKey: true  },
      { name: 'customer',   type: 'varchar', nullable: false, isPrimaryKey: false },
      { name: 'total',      type: 'decimal', nullable: true,  isPrimaryKey: false },
    ],
  },
];

describe('buildSystemPrompt', () => {
  it('includes the schema as JSON', () => {
    const prompt = buildSystemPrompt(schema, 'en');
    expect(prompt).toContain('Orders');
    expect(prompt).toContain('customer');
  });

  it('instructs the model to respond in Spanish when language is es', () => {
    const prompt = buildSystemPrompt(schema, 'es');
    expect(prompt).toContain('Spanish');
  });

  it('instructs the model to respond in English when language is en', () => {
    const prompt = buildSystemPrompt(schema, 'en');
    expect(prompt).toContain('English');
  });

  it('forbids mutation statements', () => {
    const prompt = buildSystemPrompt(schema, 'en');
    expect(prompt).toContain('NEVER generate INSERT');
    expect(prompt).toContain('DELETE');
    expect(prompt).toContain('DROP');
  });
});

describe('parseAIResponse', () => {
  it('parses a valid JSON response', () => {
    const raw = JSON.stringify({
      type:         'business',
      sql:          'SELECT 1',
      responseType: 'table',
    });
    const result = parseAIResponse(raw);
    expect(result.sql).toBe('SELECT 1');
    expect(result.type).toBe('business');
  });

  it('strips markdown code fences before parsing', () => {
    const raw = '```json\n{"type":"dmv","sql":"SELECT 2","responseType":"table"}\n```';
    const result = parseAIResponse(raw);
    expect(result.sql).toBe('SELECT 2');
  });

  it('returns a text fallback when JSON is invalid', () => {
    const result = parseAIResponse('this is not json at all');
    expect(result.responseType).toBe('text');
    expect(result.sql).toBe('');
    expect(result.textSummary).toBe('this is not json at all');
  });
});
