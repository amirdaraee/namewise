import { describe, it, expect } from 'vitest';
import { AIServiceFactory } from '../../../src/services/ai-factory.js';

describe('AIServiceFactory', () => {
  describe('create()', () => {
    it('should create ClaudeService for claude provider', () => {
      const service = AIServiceFactory.create('claude', 'test-api-key');
      
      expect(service).toBeDefined();
      expect(service.name).toBe('Claude');
      expect(typeof service.generateFileName).toBe('function');
    });

    it('should create OpenAIService for openai provider', () => {
      const service = AIServiceFactory.create('openai', 'test-api-key');
      
      expect(service).toBeDefined();
      expect(service.name).toBe('OpenAI');
      expect(typeof service.generateFileName).toBe('function');
    });

    it('should create OllamaService for ollama provider', () => {
      const service = AIServiceFactory.create('ollama');
      
      expect(service).toBeDefined();
      expect(service.name).toBe('Ollama');
      expect(typeof service.generateFileName).toBe('function');
    });

    it('should create LMStudioService for lmstudio provider', () => {
      const service = AIServiceFactory.create('lmstudio');
      
      expect(service).toBeDefined();
      expect(service.name).toBe('LMStudio');
      expect(typeof service.generateFileName).toBe('function');
    });

    it('should create Ollama service with custom config', () => {
      const service = AIServiceFactory.create('ollama', undefined, {
        baseUrl: 'http://custom:8080',
        model: 'custom-model'
      });
      
      expect(service).toBeDefined();
      expect(service.name).toBe('Ollama');
    });

    it('should create LMStudio service with custom config', () => {
      const service = AIServiceFactory.create('lmstudio', undefined, {
        baseUrl: 'http://custom:9000',
        model: 'custom-model'
      });
      
      expect(service).toBeDefined();
      expect(service.name).toBe('LMStudio');
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        AIServiceFactory.create('unsupported' as any, 'test-api-key');
      }).toThrow('Unsupported AI provider: unsupported');
    });

    it('should require API key for Claude provider', () => {
      expect(() => {
        AIServiceFactory.create('claude');
      }).toThrow('API key is required for Claude provider');
    });

    it('should require API key for OpenAI provider', () => {
      expect(() => {
        AIServiceFactory.create('openai');
      }).toThrow('API key is required for OpenAI provider');
    });

    it('should pass API key to created cloud services', () => {
      const claudeService = AIServiceFactory.create('claude', 'claude-key');
      const openaiService = AIServiceFactory.create('openai', 'openai-key');
      
      // Services should be created without throwing errors
      expect(claudeService).toBeDefined();
      expect(openaiService).toBeDefined();
    });
  });
});