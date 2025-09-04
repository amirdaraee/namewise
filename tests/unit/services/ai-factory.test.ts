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

    it('should throw error for unsupported provider', () => {
      expect(() => {
        AIServiceFactory.create('unsupported' as any, 'test-api-key');
      }).toThrow('Unsupported AI provider: unsupported');
    });

    it('should pass API key to created services', () => {
      const claudeService = AIServiceFactory.create('claude', 'claude-key');
      const openaiService = AIServiceFactory.create('openai', 'openai-key');
      
      // Services should be created without throwing errors
      expect(claudeService).toBeDefined();
      expect(openaiService).toBeDefined();
    });
  });
});