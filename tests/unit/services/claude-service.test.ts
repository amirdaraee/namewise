import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeService } from '../../../src/services/claude-service.js';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn()
    }
  }));
  return {
    default: MockAnthropic
  };
});

describe('ClaudeService', () => {
  let service: ClaudeService;
  let mockClient: any;

  beforeEach(() => {
    service = new ClaudeService('test-api-key');
    mockClient = (service as any).client;
  });

  describe('Basic Properties', () => {
    it('should have correct name', () => {
      expect(service.name).toBe('Claude');
    });

    it('should initialize with API key', () => {
      expect(service).toBeDefined();
    });
  });

  describe('generateFileName() with different naming conventions', () => {
    const sampleContent = 'This is a project requirements document for Q4 2024 planning meeting.';
    const originalName = 'document1.pdf';

    beforeEach(() => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'project requirements document q4 2024' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });
    });

    it('should generate filename with kebab-case convention (default)', async () => {
      const result = await service.generateFileName(sampleContent, originalName);

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
          messages: [expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Use lowercase with hyphens between words')
          })]
        })
      );

      expect(result.name).toBe('project-requirements-document-q4-2024');
    });

    it('should generate filename with snake_case convention', async () => {
      const result = await service.generateFileName(sampleContent, originalName, 'snake_case');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [expect.objectContaining({
            content: expect.stringContaining('Use lowercase with underscores between words')
          })]
        })
      );

      expect(result.name).toBe('project_requirements_document_q4_2024');
    });

    it('should generate filename with camelCase convention', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'project requirements document q4 2024' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      const result = await service.generateFileName(sampleContent, originalName, 'camelCase');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [expect.objectContaining({
            content: expect.stringContaining('Use camelCase format starting with lowercase')
          })]
        })
      );

      expect(result.name).toBe('projectRequirementsDocumentQ42024');
    });

    it('should generate filename with PascalCase convention', async () => {
      const result = await service.generateFileName(sampleContent, originalName, 'PascalCase');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [expect.objectContaining({
            content: expect.stringContaining('Use PascalCase format starting with uppercase')
          })]
        })
      );

      expect(result.name).toBe('ProjectRequirementsDocumentQ42024');
    });

    it('should include original filename and content in prompt', async () => {
      await service.generateFileName(sampleContent, originalName, 'kebab-case');
      
      const call = mockClient.messages.create.mock.calls[0][0];
      expect(call.messages[0].content).toContain(sampleContent.substring(0, 5000));
      expect(call.messages[0].content).toContain('Document content (first 5000 characters)');
    });

    it('should truncate long content to 5000 characters', async () => {
      const longContent = 'a'.repeat(6000);
      await service.generateFileName(longContent, originalName);

      const call = mockClient.messages.create.mock.calls[0][0];
      const contentInPrompt = call.messages[0].content;
      expect(contentInPrompt).toContain('a'.repeat(5000));
      expect(contentInPrompt).not.toContain('a'.repeat(5001));
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('API Error'));

      await expect(service.generateFileName('content', 'file.txt')).rejects.toThrow(
        'Failed to generate filename with Claude: API Error'
      );
    });

    it('should handle non-Error exceptions with unknown error message', async () => {
      mockClient.messages.create.mockRejectedValue('string error');

      await expect(service.generateFileName('content', 'file.txt')).rejects.toThrow(
        'Failed to generate filename with Claude: Unknown error'
      );
    });

    it('should handle non-text response content', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'image', text: null }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      const result = await service.generateFileName('content', 'file.txt');
      expect(result.name).toBe('untitled-document');
    });

    it('should handle empty response', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: '   ' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      const result = await service.generateFileName('content', 'file.txt');
      expect(result.name).toBe('untitled-document');
    });
  });

  describe('Filename Sanitization', () => {
    beforeEach(() => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Test File@#$ Name.pdf' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });
    });

    it('should remove file extensions from AI suggestions', async () => {
      const result = await service.generateFileName('content', 'original.txt', 'kebab-case');
      expect(result.name).toBe('test-file-name');
    });

    it('should handle very long filenames', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'a'.repeat(150) }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      const result = await service.generateFileName('content', 'file.txt', 'kebab-case');
      expect(result.name.length).toBeLessThanOrEqual(100);
    });

    it('should preserve naming convention when truncating', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'very long filename that should be truncated properly' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      const kebabResult = await service.generateFileName('content', 'file.txt', 'kebab-case');
      expect(kebabResult.name).not.toMatch(/-$/); // Should not end with hyphen

      const snakeResult = await service.generateFileName('content', 'file.txt', 'snake_case');
      expect(snakeResult.name).not.toMatch(/_$/); // Should not end with underscore
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
        mockClient.messages.create.mockResolvedValue({
          content: [{ type: 'text', text: input }],
          usage: { input_tokens: 100, output_tokens: 10 }
        });
        const result = await service.generateFileName('content', 'file.txt', 'kebab-case');
        expect(result.name).toBe(expected);
      }
    });

    it('should handle snake_case truncation removing partial word at end', async () => {
      // This name becomes exactly 101 chars in snake_case, so truncation is triggered
      // After substring(0, 100), it ends with '_' which gets cleaned up
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'a_very_long_filename_that_exceeds_the_one_hundred_character_limit_and_needs_truncation_applied_here_x' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      const result = await service.generateFileName('content', 'file.txt', 'snake_case');
      expect(result.name.length).toBeLessThanOrEqual(100);
      expect(result.name).not.toMatch(/_$/);
    });
  });

  describe('Scanned PDF handling', () => {
    it('should throw when scanned PDF image data has no data: prefix', async () => {
      const scannedContent = '[SCANNED_PDF_IMAGE]:notadataurl';
      await expect(service.generateFileName(scannedContent, 'scan.pdf')).rejects.toThrow(
        'Invalid scanned PDF image data format'
      );
    });

    it('should throw when scanned PDF image data has no comma separator', async () => {
      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/jpegNOCOMMA';
      await expect(service.generateFileName(scannedContent, 'scan.pdf')).rejects.toThrow(
        'Invalid scanned PDF image data format'
      );
    });

    it('should handle scanned PDF with JPEG image using vision model', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'visa-application' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,/9j/fakebase64data';
      const result = await service.generateFileName(scannedContent, 'scan.pdf');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
          messages: [expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({
                type: 'image',
                source: expect.objectContaining({ media_type: 'image/jpeg' })
              })
            ])
          })]
        })
      );
      expect(result.name).toBe('visa-application');
    });

    it('should handle scanned PDF with PNG image', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'document-scan' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/png;base64,iVBORwfakedata';
      const result = await service.generateFileName(scannedContent, 'scan.pdf');

      const call = mockClient.messages.create.mock.calls[0][0];
      const imageContent = call.messages[0].content.find((c: any) => c.type === 'image');
      expect(imageContent.source.media_type).toBe('image/png');
      expect(result.name).toBe('document-scan');
    });

    it('should extract base64 data correctly from scanned PDF content', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'scanned-document' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      const base64Data = '/9j/4AAQSkZJRgABAQ==';
      const scannedContent = `[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,${base64Data}`;
      await service.generateFileName(scannedContent, 'scan.pdf');

      const call = mockClient.messages.create.mock.calls[0][0];
      const imageContent = call.messages[0].content.find((c: any) => c.type === 'image');
      expect(imageContent.source.data).toBe(base64Data);
    });
  });

  describe('Custom model parameter', () => {
    it('should use default model when none provided', async () => {
      const defaultService = new ClaudeService('test-key');
      const defaultClient = (defaultService as any).client;
      defaultClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'test-name' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      await defaultService.generateFileName('sample content', 'file.txt');

      expect(defaultClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-5-20250929' })
      );
    });

    it('should use the custom model for text requests when provided', async () => {
      const customModel = 'claude-opus-4-6';
      const customService = new ClaudeService('test-key', customModel);
      const customClient = (customService as any).client;
      customClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'test-name' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      await customService.generateFileName('sample content', 'file.txt');

      expect(customClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: customModel })
      );
    });

    it('should use the custom model for vision (scanned PDF) requests', async () => {
      const customModel = 'claude-opus-4-6';
      const customService = new ClaudeService('test-key', customModel);
      const customClient = (customService as any).client;
      customClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'scanned-doc' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      });

      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,/9j/fake';
      await customService.generateFileName(scannedContent, 'scan.pdf');

      expect(customClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: customModel })
      );
    });
  });

  describe('Token usage extraction', () => {
    it('should return input and output token counts from text response', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'document-name' }],
        usage: { input_tokens: 250, output_tokens: 15 }
      });

      const result = await service.generateFileName('content', 'file.txt');

      expect(result.name).toBe('document-name');
      expect(result.inputTokens).toBe(250);
      expect(result.outputTokens).toBe(15);
    });

    it('should return input and output token counts from vision (scanned PDF) response', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'scanned-invoice' }],
        usage: { input_tokens: 800, output_tokens: 8 }
      });

      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,/9j/fake';
      const result = await service.generateFileName(scannedContent, 'scan.pdf');

      expect(result.name).toBe('scanned-invoice');
      expect(result.inputTokens).toBe(800);
      expect(result.outputTokens).toBe(8);
    });

    it('should return undefined tokens when usage is absent', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'some-name' }]
        // no usage field
      });

      const result = await service.generateFileName('content', 'file.txt');

      expect(result.inputTokens).toBeUndefined();
      expect(result.outputTokens).toBeUndefined();
    });
  });

  describe('context parameter', () => {
    it('should pass context to buildFileNamePrompt when provided', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'tax-return-2023' }],
        usage: { input_tokens: 50, output_tokens: 5 }
      });
      await service.generateFileName('Document content', 'doc.pdf', 'kebab-case', 'general', undefined, undefined, 'These are tax documents');
      const callArg = mockClient.messages.create.mock.calls[0][0];
      expect(callArg.messages[0].content).toContain('User-provided context:');
      expect(callArg.messages[0].content).toContain('These are tax documents');
    });
  });
});