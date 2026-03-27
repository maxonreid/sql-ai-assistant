import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider } from './aiProvider';
import type { AIResponse, AIProviderConfig, SchemaTable } from '@sql-assistant/shared';
import { buildSystemPrompt, parseAIResponse } from './promptBuilder';

// Claude implementation of the generic AIProvider interface.
export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(config: AIProviderConfig) {
    // Reads the Anthropic API key from environment variables.
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // Allows model selection from app configuration (for example: claude-3-5-sonnet).
    this.model = config.anthropic_model;
  }

  async generateSQL(args: {
    question: string;
    schema: SchemaTable[];
    language: string;
  }): Promise<AIResponse> {
    // Builds a schema-aware system prompt so Claude knows table/column context.
    const systemPrompt = buildSystemPrompt(args.schema, args.language);

    // Sends the user's natural-language question to Claude.
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: args.question }],
    });

    // Anthropic returns content blocks; this provider expects the first block to be text.
    const raw = (message.content[0] as { text: string }).text;

    // Normalizes model output into the app's AIResponse shape.
    return parseAIResponse(raw);
  }
}