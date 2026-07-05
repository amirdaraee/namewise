import Anthropic from '@anthropic-ai/sdk';
import { BaseCloudService, CloudApiError, TokenUsage } from './base-cloud-service.js';

export class ClaudeService extends BaseCloudService<Anthropic.Message> {
  private client: Anthropic;

  constructor(apiKey: string, model?: string) {
    super('Claude', model ?? 'claude-opus-4-8');
    this.client = new Anthropic({ apiKey });
  }

  protected createTextCompletion(prompt: string): Promise<Anthropic.Message> {
    return this.client.messages.create({
      model: this.model,
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    });
  }

  protected createImageCompletion(prompt: string, imageData: string): Promise<Anthropic.Message> {
    return this.client.messages.create({
      model: this.model,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageData.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
                data: imageData.split(',')[1]
              }
            }
          ]
        }
      ]
    });
  }

  protected extractSuggestedName(response: Anthropic.Message): string {
    return response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : 'untitled-document';
  }

  protected extractTokenUsage(response: Anthropic.Message): TokenUsage {
    return {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens
    };
  }

  protected asApiError(error: unknown): CloudApiError | undefined {
    return error instanceof Anthropic.APIError ? error : undefined;
  }
}
