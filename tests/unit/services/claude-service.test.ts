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
          model: 'claude-3-haiku-20240307',
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
      expect(call.messages[0].content).toContain(`Original filename: ${originalName}`);
      expect(call.messages[0].content).toContain(sampleContent.substring(0, 2000));
    });

    it('should truncate long content to 2000 characters', async () => {
      const longContent = 'a'.repeat(3000);
      await service.generateFileName(longContent, originalName);
      
      const call = mockClient.messages.create.mock.calls[0][0];
      const contentInPrompt = call.messages[0].content;
      // Should only contain first 2000 characters
      expect(contentInPrompt).toContain('a'.repeat(2000));
      expect(contentInPrompt).not.toContain('a'.repeat(2001));
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('API Error'));
      
      await expect(service.generateFileName('content', 'file.txt')).rejects.toThrow(
        'Failed to generate filename with Claude: API Error'
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
  });
});