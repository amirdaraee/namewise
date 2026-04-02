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
          model: 'gpt-4o',
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
      expect(call.messages[0].content).toContain(sampleContent.substring(0, 5000));
      expect(call.messages[0].content).toContain('Document content (first 5000 characters)');
    });

    it('should use correct OpenAI parameters', async () => {
      await service.generateFileName(sampleContent, originalName);

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
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

    it('should handle non-Error exceptions with unknown error message', async () => {
      mockClient.chat.completions.create.mockRejectedValue('string error');

      await expect(service.generateFileName('content', 'file.txt')).rejects.toThrow(
        'Failed to generate filename with OpenAI: Unknown error'
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

    it('should use untitled-document when sanitized name is empty', async () => {
      // Special chars that are not alphanumeric, spaces, or hyphens → empty after normalization
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '@@@###$$$' } }]
      });
      const result = await service.generateFileName('content', 'file.txt', 'kebab-case');
      expect(result).toBe('untitled-document');
    });

    it('should truncate long kebab-case filenames removing partial word at end', async () => {
      // This name becomes exactly 101 chars in kebab-case, triggering truncation
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'a-very-long-kebab-case-filename-that-is-definitely-over-one-hundred-characters-in-total-length-yes-xy' } }]
      });
      const result = await service.generateFileName('content', 'file.txt', 'kebab-case');
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result).not.toMatch(/-$/);
    });

    it('should strip Windows-illegal characters from AI suggestions', async () => {
      const illegalChars = [
        ['Contract: Q4 2024', 'contract-q4-2024'],
        ['Report? Final*', 'report-final'],
        ['Invoice <2024>', 'invoice-2024'],
        ['File|Name"Here', 'file-name-here'],
        ['Path\\Sub/Dir', 'path-sub-dir'],
      ] as const;

      for (const [input, expected] of illegalChars) {
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [{ message: { content: input } }]
        });
        const result = await service.generateFileName('content', 'file.txt', 'kebab-case');
        expect(result).toBe(expected);
      }
    });

    it('should truncate long snake_case filenames removing partial word at end', async () => {
      // 102-char snake_case string → triggers the > 100 truncation branch
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'a_very_long_snake_case_name_that_is_definitely_over_one_hundred_characters_in_total_length_yes_yes_x_z' } }]
      });
      const result = await service.generateFileName('content', 'file.txt', 'snake_case');
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result).not.toMatch(/_$/);
    });
  });

  describe('Scanned PDF handling', () => {
    it('should handle scanned PDF with image_url using gpt-4o', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'visa-document' } }]
      });

      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,/9j/fakebase64data';
      const result = await service.generateFileName(scannedContent, 'scan.pdf');

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: [expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({ type: 'image_url' })
            ])
          })]
        })
      );
      expect(result).toBe('visa-document');
    });

    it('should pass the full base64 URL to image_url', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'scanned-doc' } }]
      });

      const imageUrl = 'data:image/jpeg;base64,/9j/fakebase64data';
      const scannedContent = `[SCANNED_PDF_IMAGE]:${imageUrl}`;
      await service.generateFileName(scannedContent, 'scan.pdf');

      const call = mockClient.chat.completions.create.mock.calls[0][0];
      const imageContent = call.messages[0].content.find((c: any) => c.type === 'image_url');
      expect(imageContent.image_url.url).toBe(imageUrl);
    });
  });

  describe('Custom model parameter', () => {
    it('should use default model gpt-4o when none provided', async () => {
      const defaultService = new OpenAIService('test-key');
      const defaultClient = (defaultService as any).client;
      defaultClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'test-name' } }]
      });

      await defaultService.generateFileName('sample content', 'file.txt');

      expect(defaultClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o' })
      );
    });

    it('should use the custom model for text requests when provided', async () => {
      const customModel = 'gpt-4-turbo';
      const customService = new OpenAIService('test-key', customModel);
      const customClient = (customService as any).client;
      customClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'test-name' } }]
      });

      await customService.generateFileName('sample content', 'file.txt');

      expect(customClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: customModel })
      );
    });

    it('should use the custom model for vision (scanned PDF) requests', async () => {
      const customModel = 'gpt-4-turbo';
      const customService = new OpenAIService('test-key', customModel);
      const customClient = (customService as any).client;
      customClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'scanned-doc' } }]
      });

      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,/9j/fake';
      await customService.generateFileName(scannedContent, 'scan.pdf');

      expect(customClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: customModel })
      );
    });
  });
});