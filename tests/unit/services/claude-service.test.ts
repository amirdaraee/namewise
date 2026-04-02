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
        content: [{ type: 'text', text: 'project requirements document q4 2024' }]
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
      
      expect(result).toBe('project-requirements-document-q4-2024');
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
      
      expect(result).toBe('project_requirements_document_q4_2024');
    });

    it('should generate filename with camelCase convention', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'project requirements document q4 2024' }]
      });

      const result = await service.generateFileName(sampleContent, originalName, 'camelCase');
      
      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [expect.objectContaining({
            content: expect.stringContaining('Use camelCase format starting with lowercase')
          })]
        })
      );
      
      expect(result).toBe('projectRequirementsDocumentQ42024');
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
      
      expect(result).toBe('ProjectRequirementsDocumentQ42024');
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
        content: [{ type: 'image', text: null }]
      });
      
      const result = await service.generateFileName('content', 'file.txt');
      expect(result).toBe('untitled-document');
    });

    it('should handle empty response', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: '   ' }]
      });
      
      const result = await service.generateFileName('content', 'file.txt');
      expect(result).toBe('untitled-document');
    });
  });

  describe('Filename Sanitization', () => {
    beforeEach(() => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Test File@#$ Name.pdf' }]
      });
    });

    it('should remove file extensions from AI suggestions', async () => {
      const result = await service.generateFileName('content', 'original.txt', 'kebab-case');
      expect(result).toBe('test-file-name');
    });

    it('should handle very long filenames', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'a'.repeat(150) }]
      });

      const result = await service.generateFileName('content', 'file.txt', 'kebab-case');
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should preserve naming convention when truncating', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'very long filename that should be truncated properly' }]
      });

      const kebabResult = await service.generateFileName('content', 'file.txt', 'kebab-case');
      expect(kebabResult).not.toMatch(/-$/); // Should not end with hyphen

      const snakeResult = await service.generateFileName('content', 'file.txt', 'snake_case');
      expect(snakeResult).not.toMatch(/_$/); // Should not end with underscore
    });

    it('should handle snake_case truncation removing partial word at end', async () => {
      // This name becomes exactly 101 chars in snake_case, so truncation is triggered
      // After substring(0, 100), it ends with '_' which gets cleaned up
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'a_very_long_filename_that_exceeds_the_one_hundred_character_limit_and_needs_truncation_applied_here_x' }]
      });

      const result = await service.generateFileName('content', 'file.txt', 'snake_case');
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result).not.toMatch(/_$/);
    });
  });

  describe('Scanned PDF handling', () => {
    it('should handle scanned PDF with JPEG image using vision model', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'visa-application' }]
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
      expect(result).toBe('visa-application');
    });

    it('should handle scanned PDF with PNG image', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'document-scan' }]
      });

      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/png;base64,iVBORwfakedata';
      const result = await service.generateFileName(scannedContent, 'scan.pdf');

      const call = mockClient.messages.create.mock.calls[0][0];
      const imageContent = call.messages[0].content.find((c: any) => c.type === 'image');
      expect(imageContent.source.media_type).toBe('image/png');
      expect(result).toBe('document-scan');
    });

    it('should extract base64 data correctly from scanned PDF content', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'scanned-document' }]
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
        content: [{ type: 'text', text: 'test-name' }]
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
        content: [{ type: 'text', text: 'test-name' }]
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
        content: [{ type: 'text', text: 'scanned-doc' }]
      });

      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,/9j/fake';
      await customService.generateFileName(scannedContent, 'scan.pdf');

      expect(customClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: customModel })
      );
    });
  });
});