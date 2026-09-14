import { AIProvider } from '../types/index.js';
import { ClaudeService } from './claude-service.js';
import { OpenAIService } from './openai-service.js';
import { OllamaService } from './ollama-service.js';
import { LMStudioService } from './lmstudio-service.js';
import { NineRouterService, NINEROUTER_DEFAULT_BASE_URL } from './ninerouter-service.js';
import { AuthError, ConfigError } from '../errors.js';

interface LocalLLMConfig {
  baseUrl?: string;
  model?: string;
}

export class AIServiceFactory {
  static create(
    provider: 'claude' | 'openai' | 'ollama' | 'lmstudio' | '9router', 
    apiKey?: string,
    localLLMConfig?: LocalLLMConfig
  ): AIProvider {
    switch (provider) {
      case 'claude':
        if (!apiKey) throw new AuthError('API key is required for Claude provider');
        return new ClaudeService(apiKey, localLLMConfig?.model);
      case 'openai':
        if (!apiKey) throw new AuthError('API key is required for OpenAI provider');
        return new OpenAIService(apiKey, localLLMConfig?.model);
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
      case '9router':
        if (!apiKey) throw new AuthError('API key is required for 9Router provider');
        // 9Router namespaces models by upstream (glm/…, minimax/…, cc/…), so
        // there is no meaningful default to fall back on.
        if (!localLLMConfig?.model) {
          throw new ConfigError(
            'A model is required for the 9Router provider. Pass --model, e.g. --model glm/glm-5.1 ' +
            '(other prefixes: cc/, cx/, gh/, minimax/, kr/, vertex/).'
          );
        }
        return new NineRouterService(
          apiKey,
          localLLMConfig?.baseUrl || NINEROUTER_DEFAULT_BASE_URL,
          localLLMConfig.model
        );
      default:
        throw new ConfigError(`Unsupported AI provider: ${provider}`);
    }
  }
}