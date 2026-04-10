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
        ],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
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

      expect(result.name).toBe('user-manual-software-installation-configuration');
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

      expect(result.name).toBe('user_manual_software_installation_configuration');
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

      expect(result.name).toBe('userManualSoftwareInstallationConfiguration');
    });

    it('should generate filename with UPPERCASE convention', async () => {
      const result = await service.generateFileName(sampleContent, originalName, 'UPPERCASE');

      expect(result.name).toBe('USERMANUALSOFTWAREINSTALLATIONCONFIGURATION');
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
        choices: [],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
      });

      const result = await service.generateFileName('content', 'file.txt');
      expect(result.name).toBe('untitled-document');
    });

    it('should handle missing message content', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: null
            }
          }
        ],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
      });

      const result = await service.generateFileName('content', 'file.txt');
      expect(result.name).toBe('untitled-document');
    });

    it('should handle undefined choices', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [undefined],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
      });

      const result = await service.generateFileName('content', 'file.txt');
      expect(result.name).toBe('untitled-document');
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
        ],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
      });
    });

    it('should sanitize special characters and apply naming convention', async () => {
      const result = await service.generateFileName('content', 'original.txt', 'kebab-case');
      expect(result.name).toBe('testdocumentwithspecialcharacters');
    });

    it('should handle different conventions for sanitized input', async () => {
      const kebabResult = await service.generateFileName('content', 'file.txt', 'kebab-case');
      const snakeResult = await service.generateFileName('content', 'file.txt', 'snake_case');
      const camelResult = await service.generateFileName('content', 'file.txt', 'camelCase');

      expect(kebabResult.name).toBe('testdocumentwithspecialcharacters');
      expect(snakeResult.name).toBe('testdocumentwithspecialcharacters');
      expect(camelResult.name).toBe('testdocumentwithspecialcharacters');
    });

    it('should use untitled-document when sanitized name is empty', async () => {
      // Special chars that are not alphanumeric, spaces, or hyphens → empty after normalization
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '@@@###$$$' } }],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
      });
      const result = await service.generateFileName('content', 'file.txt', 'kebab-case');
      expect(result.name).toBe('untitled-document');
    });

    it('should truncate long kebab-case filenames removing partial word at end', async () => {
      // This name becomes exactly 101 chars in kebab-case, triggering truncation
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'a-very-long-kebab-case-filename-that-is-definitely-over-one-hundred-characters-in-total-length-yes-xy' } }],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
      });
      const result = await service.generateFileName('content', 'file.txt', 'kebab-case');
      expect(result.name.length).toBeLessThanOrEqual(100);
      expect(result.name).not.toMatch(/-$/);
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
          choices: [{ message: { content: input } }],
          usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
        });
        const result = await service.generateFileName('content', 'file.txt', 'kebab-case');
        expect(result.name).toBe(expected);
      }
    });

    it('should truncate long snake_case filenames removing partial word at end', async () => {
      // 102-char snake_case string → triggers the > 100 truncation branch
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'a_very_long_snake_case_name_that_is_definitely_over_one_hundred_characters_in_total_length_yes_yes_x_z' } }],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
      });
      const result = await service.generateFileName('content', 'file.txt', 'snake_case');
      expect(result.name.length).toBeLessThanOrEqual(100);
      expect(result.name).not.toMatch(/_$/);
    });
  });

  describe('Vision (imageData param) handling', () => {
    it('should throw when imageData is invalid format', async () => {
      await expect(
        service.generateFileName('', 'scan.pdf', 'kebab-case', 'general', undefined, undefined, undefined, 'notadataurl')
      ).rejects.toThrow('Invalid image data format');
    });

    it('should send image_url content when imageData is provided', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'vacation-photo' } }],
        usage: { prompt_tokens: 200, completion_tokens: 8 }
      });

      const result = await service.generateFileName(
        '', 'photo.jpg', 'kebab-case', 'photo', undefined, undefined, undefined,
        'data:image/jpeg;base64,/9j/fakedata'
      );

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({
                type: 'image_url',
                image_url: expect.objectContaining({ url: 'data:image/jpeg;base64,/9j/fakedata' })
              })
            ])
          })]
        })
      );
      expect(result.name).toBe('vacation-photo');
    });

    it('should use text path when imageData is undefined', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'text-document' } }],
        usage: { prompt_tokens: 50, completion_tokens: 5 }
      });

      await service.generateFileName('some text content', 'doc.txt');

      const call = mockClient.chat.completions.create.mock.calls[0][0];
      expect(typeof call.messages[0].content).toBe('string');
    });
  });

  describe('Custom model parameter', () => {
    it('should use default model gpt-4o when none provided', async () => {
      const defaultService = new OpenAIService('test-key');
      const defaultClient = (defaultService as any).client;
      defaultClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'test-name' } }],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
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
        choices: [{ message: { content: 'test-name' } }],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
      });

      await customService.generateFileName('sample content', 'file.txt');

      expect(customClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: customModel })
      );
    });

    it('should use the custom model for vision (imageData) requests', async () => {
      const customModel = 'gpt-4-turbo';
      const customService = new OpenAIService('test-key', customModel);
      const customClient = (customService as any).client;
      customClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'scanned-doc' } }],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
      });

      await customService.generateFileName('', 'scan.pdf', 'kebab-case', 'general', undefined, undefined, undefined, 'data:image/jpeg;base64,/9j/fake');

      expect(customClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: customModel })
      );
    });
  });

  describe('Token usage extraction', () => {
    it('should return prompt and completion token counts', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'quarterly-report', role: 'assistant' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 320, completion_tokens: 12, total_tokens: 332 }
      });

      const result = await service.generateFileName('report content', 'report.pdf');

      expect(result.name).toBe('quarterly-report');
      expect(result.inputTokens).toBe(320);
      expect(result.outputTokens).toBe(12);
    });

    it('should return undefined tokens when usage is absent', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'some-name', role: 'assistant' }, finish_reason: 'stop' }]
        // no usage field
      });

      const result = await service.generateFileName('content', 'file.txt');

      expect(result.inputTokens).toBeUndefined();
      expect(result.outputTokens).toBeUndefined();
    });

    it('should return token counts from vision (imageData) response', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'scanned-invoice' } }],
        usage: { prompt_tokens: 800, completion_tokens: 8 }
      });

      const result = await service.generateFileName(
        '', 'scan.pdf', 'kebab-case', 'general', undefined, undefined, undefined,
        'data:image/jpeg;base64,/9j/fake'
      );

      expect(result.inputTokens).toBe(800);
      expect(result.outputTokens).toBe(8);
    });

    it('should return undefined tokens for vision (imageData) when usage is absent', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'scanned-doc', role: 'assistant' }, finish_reason: 'stop' }]
      });

      const result = await service.generateFileName(
        '', 'scan.pdf', 'kebab-case', 'general', undefined, undefined, undefined,
        'data:image/jpeg;base64,/9j/fakedata'
      );

      expect(result.inputTokens).toBeUndefined();
      expect(result.outputTokens).toBeUndefined();
    });
  });

  describe('context parameter', () => {
    it('should pass context to buildFileNamePrompt when provided', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'tax-return-2023' } }],
        usage: { prompt_tokens: 50, completion_tokens: 5 }
      });
      await service.generateFileName('Document content', 'doc.pdf', 'kebab-case', 'general', undefined, undefined, 'These are tax documents');
      const callArg = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArg.messages[0].content).toContain('User-provided context:');
      expect(callArg.messages[0].content).toContain('These are tax documents');
    });
  });
});
