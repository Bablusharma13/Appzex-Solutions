import OpenAI from 'openai';
import { env } from '../../config/env';

/**
 * Thin provider interface so the AI vendor can be swapped (or mocked in
 * tests) without touching the business logic in aiService.
 */
export interface AIProvider {
  readonly model: string;
  completeJson(params: { system: string; user: string }): Promise<string>;
}

let client: OpenAI | null = null;

/** Returns null when OPENAI_API_KEY is not configured. */
export function getAIProvider(): AIProvider | null {
  if (!env.aiEnabled) return null;

  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: env.AI_TIMEOUT_MS, maxRetries: 1 });
  const openai = client;

  return {
    model: env.openaiModel,
    async completeJson({ system, user }) {
      const completion = await openai.chat.completions.create({
        model: env.openaiModel,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      return completion.choices[0]?.message?.content ?? '';
    },
  };
}
