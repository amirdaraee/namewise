import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIService } from '../../../src/services/openai-service.js';

// Mock the OpenAI SDK
vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }));
  return {
    default: MockOpenAI
  };
});

describe('OpenAIService', () => {
  let service: OpenAIService;
  let mockClient: any;

  beforeEach(() => {
    service = new OpenAIService('test-api-key');
    mockClient = (service as any).client;
  });

  describe('Basic Properties', () => {
    it('should have correct name', () => {
      expect(service.name).toBe('OpenAI');
    });

    it('should initialize with API key', () => {
      expect(service).toBeDefined();
    });
  });

  describe('generateFileName() with different naming conventions', () => {
    const sampleContent = 'This is a user manual for software installation and configuration.';
    const originalName = 'manual.docx';

    beforeEach(() => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'user manual software installation configuration'
            }
          }
        ]
      });
    });

    it('should generate filename with kebab-case convention (default)', async () => {
      const result = await service.generateFileName(sampleContent, originalName);
      
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          messages: [expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Use lowercase with hyphens between words')
          })],
          temperature: 0.3
        })
      );
      
      expect(result).toBe('user-manual-software-installation-configuration');
    });

    it('should generate filename with snake_case convention', async () => {
      const result = await service.generateFileName(sampleContent, originalName, 'snake_case');
      
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [expect.objectContaining({
            content: expect.stringContaining('Use lowercase with underscores between words')
          })]
        })
      );
      
      expect(result).toBe('user_manual_software_installation_configuration');
    });

    it('should generate filename with camelCase convention', async () => {
      const result = await service.generateFileName(sampleContent, originalName, 'camelCase');
      
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [expect.objectContaining({
            content: expect.stringContaining('Use camelCase format starting with lowercase')
          })]
        })
      );
      
      expect(result).toBe('userManualSoftwareInstallationConfiguration');
    });

    it('should generate filename with UPPERCASE convention', async () => {
      const result = await service.generateFileName(sampleContent, originalName, 'UPPERCASE');
      
      expect(result).toBe('USERMANUALSOFTWAREINSTALLATIONCONFIGURATION');
    });

    it('should include original filename and content in prompt', async () => {
      await service.generateFileName(sampleContent, originalName, 'kebab-case');
      
      const call = mockClient.chat.completions.create.mock.calls[0][0];
      expect(call.messages[0].content).toContain(sampleContent.substring(0, 2000));
      expect(call.messages[0].content).toContain('Document content (first 2000 characters)');
    });

    it('should use correct OpenAI parameters', async () => {
      await service.generateFileName(sampleContent, originalName);
      
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          max_tokens: 100,
          temperature: 0.3
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockClient.chat.completions.create.mockRejectedValue(new Error('OpenAI API Error'));
      
      await expect(service.generateFileName('content', 'file.txt')).rejects.toThrow(
        'Failed to generate filename with OpenAI: OpenAI API Error'
      );
    });

    it('should handle empty choices response', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: []
      });
      
      const result = await service.generateFileName('content', 'file.txt');
      expect(result).toBe('untitled-document');
    });

    it('should handle missing message content', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: null
            }
          }
        ]
      });
      
      const result = await service.generateFileName('content', 'file.txt');
      expect(result).toBe('untitled-document');
    });

    it('should handle undefined choices', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [undefined]
      });
      
      const result = await service.generateFileName('content', 'file.txt');
      expect(result).toBe('untitled-document');
    });
  });

  describe('Filename Sanitization', () => {
    beforeEach(() => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Test@Document#With$Special%Characters.xlsx'
            }
          }
        ]
      });
    });

    it('should sanitize special characters and apply naming convention', async () => {
      const result = await service.generateFileName('content', 'original.txt', 'kebab-case');
      expect(result).toBe('testdocumentwithspecialcharacters');
    });

    it('should handle different conventions for sanitized input', async () => {
      const kebabResult = await service.generateFileName('content', 'file.txt', 'kebab-case');
      const snakeResult = await service.generateFileName('content', 'file.txt', 'snake_case');
      const camelResult = await service.generateFileName('content', 'file.txt', 'camelCase');
      
      expect(kebabResult).toBe('testdocumentwithspecialcharacters');
      expect(snakeResult).toBe('testdocumentwithspecialcharacters');
      expect(camelResult).toBe('testdocumentwithspecialcharacters');
    });
  });
});