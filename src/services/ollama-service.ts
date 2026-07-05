import { AI_SYSTEM_PROMPT } from '../utils/ai-prompts.js';
import { BaseLocalService } from './base-local-service.js';

interface OllamaResponse {
  model: string;
  response?: string;
  message?: { content: string; role: string };
  done: boolean;
}

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
}

interface OllamaModelInfo {
  name: string;
}

export class OllamaService extends BaseLocalService<OllamaChatRequest, OllamaResponse> {
  constructor(baseUrl = 'http://localhost:11434', model = 'llama3.1') {
    super('Ollama', baseUrl, model);
  }

  protected async requestCompletion(prompt: string, imageData?: string): Promise<string | undefined> {
    const userMessage: OllamaChatMessage = imageData
      ? { role: 'user', content: prompt, images: [imageData.split(',')[1]] }
      : { role: 'user', content: prompt };

    const response = await this.makeRequest('/api/chat', {
      model: this.model,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        userMessage
      ],
      stream: false
    });

    return response.message?.content;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models?.map((model: OllamaModelInfo) => model.name) || [];
    } catch {
      return [];
    }
  }
}
