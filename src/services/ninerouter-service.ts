import { AI_SYSTEM_PROMPT } from '../utils/ai-prompts.js';
import { BaseLocalService, LocalCompletion } from './base-local-service.js';

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

interface NineRouterChatRequest {
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

export const NINEROUTER_DEFAULT_BASE_URL = 'http://localhost:20128';

/**
 * 9Router (https://9router.com) is a self-hosted gateway exposing one
 * OpenAI-compatible endpoint that fans out to 40+ upstream providers with
 * tiered fallback. It runs locally but, unlike Ollama and LMStudio, requires
 * a 9Router-issued key — separate from the upstream provider keys it holds.
 *
 * Models are namespaced by upstream (`glm/…`, `minimax/…`, `cc/…`, `vertex/…`),
 * so there is no sensible default: the caller must choose one.
 */
export class NineRouterService extends BaseLocalService<NineRouterChatRequest, OpenAICompatibleResponse> {
  constructor(apiKey: string, baseUrl = NINEROUTER_DEFAULT_BASE_URL, model: string) {
    super('9Router', baseUrl, model, apiKey);
  }

  protected async requestCompletion(prompt: string, imageData?: string): Promise<LocalCompletion> {
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

    // Unlike Ollama and LMStudio, 9Router fronts paid upstreams, so its usage
    // counts are the number the user actually cares about.
    return {
      content: response.choices?.[0]?.message?.content,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens
    };
  }

  /** True when the gateway answers on /v1/models with this key. */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, { headers: this.authHeaders() });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Model ids the gateway will route to, e.g. glm/glm-5.1, minimax/m2.7. */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, { headers: this.authHeaders() });
      if (!response.ok) return [];

      const data = await response.json();
      return data.data?.map((model: ModelInfo) => model.id) || [];
    } catch {
      return [];
    }
  }
}
