import OpenAI from 'openai';
import { BaseCloudService, CloudApiError, TokenUsage } from './base-cloud-service.js';

export class OpenAIService extends BaseCloudService<OpenAI.Chat.Completions.ChatCompletion> {
  private client: OpenAI;

  constructor(apiKey: string, model?: string) {
    super('OpenAI', model ?? 'gpt-5.5');
    this.client = new OpenAI({ apiKey });
  }

  protected createTextCompletion(prompt: string): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.3
    });
  }

  protected createImageCompletion(prompt: string, imageData: string): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ],
      max_tokens: 100,
      temperature: 0.3
    });
  }

  protected extractSuggestedName(response: OpenAI.Chat.Completions.ChatCompletion): string {
    return response.choices[0]?.message?.content?.trim() || 'untitled-document';
  }

  protected extractTokenUsage(response: OpenAI.Chat.Completions.ChatCompletion): TokenUsage {
    return {
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens
    };
  }

  protected asApiError(error: unknown): CloudApiError | undefined {
    return error instanceof OpenAI.APIError ? error : undefined;
  }
}
