import { AI_SYSTEM_PROMPT } from '../utils/ai-prompts.js';
import { BaseLocalService } from './base-local-service.js';

interface OpenAICompatibleResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface LMStudioChatRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature: number;
  max_tokens: number;
  stream: boolean;
}

interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export class LMStudioService extends BaseLocalService<LMStudioChatRequest, OpenAICompatibleResponse> {
  constructor(
    baseUrl = 'http://localhost:1234',
    model = 'local-model'
  ) {
    super('LMStudio', baseUrl, model);
  }

  protected async requestCompletion(prompt: string, imageData?: string): Promise<string | undefined> {
    const userMessage: OpenAIMessage = imageData
      ? {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      : { role: 'user', content: prompt };

    const response = await this.makeRequest('/v1/chat/completions', {
      model: this.model,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        userMessage
      ],
      temperature: 0.3,
      max_tokens: 100,
      stream: false
    });

    return response.choices?.[0]?.message?.content;
  }

  // Method to check if LMStudio service is available
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Method to list available models
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`);
      if (!response.ok) return [];

      const data = await response.json();
      return data.data?.map((model: ModelInfo) => model.id) || [];
    } catch {
      return [];
    }
  }
}
