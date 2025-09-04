import { AIProvider } from '../types/index.js';
import { ClaudeService } from './claude-service.js';
import { OpenAIService } from './openai-service.js';

export class AIServiceFactory {
  static create(provider: 'claude' | 'openai', apiKey: string): AIProvider {
    switch (provider) {
      case 'claude':
        return new ClaudeService(apiKey);
      case 'openai':
        return new OpenAIService(apiKey);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }
}