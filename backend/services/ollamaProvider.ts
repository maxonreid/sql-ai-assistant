import type { AIProvider } from './aiProvider';
import type { AIResponse, AIProviderConfig, SchemaTable } from '@sql-assistant/shared';
import { buildSystemPrompt, parseAIResponse } from './promptBuilder';

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.baseUrl = config.ollama_url;
    this.model = config.local_model;
  }

  async generateSQL(args: {
    question: string;
    schema: SchemaTable[];
    language: string;
  }): Promise<AIResponse> {
    const systemPrompt = buildSystemPrompt(args.schema, args.language);

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: args.question },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const data = await res.json() as { message: { content: string } };
    return parseAIResponse(data.message.content);
  }
}