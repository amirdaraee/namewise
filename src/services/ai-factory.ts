import { AIProvider } from '../types/index.js';
import { ClaudeService } from './claude-service.js';
import { OpenAIService } from './openai-service.js';
import { OllamaService } from './ollama-service.js';
import { LMStudioService } from './lmstudio-service.js';

interface LocalLLMConfig {
  baseUrl?: string;
  model?: string;
}

export class AIServiceFactory {
  static create(
    provider: 'claude' | 'openai' | 'ollama' | 'lmstudio', 
    apiKey?: string,
    localLLMConfig?: LocalLLMConfig
  ): AIProvider {
    switch (provider) {
      case 'claude':
        if (!apiKey) throw new Error('API key is required for Claude provider');
        return new ClaudeService(apiKey);
      case 'openai':
        if (!apiKey) throw new Error('API key is required for OpenAI provider');
        return new OpenAIService(apiKey);
      case 'ollama':
        return new OllamaService(
          localLLMConfig?.baseUrl || 'http://localhost:11434',
          localLLMConfig?.model || 'llama3.1'
        );
      case 'lmstudio':
        return new LMStudioService(
          localLLMConfig?.baseUrl || 'http://localhost:1234',
          localLLMConfig?.model || 'local-model'
        );
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }
}