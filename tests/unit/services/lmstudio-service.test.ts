import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LMStudioService } from '../../../src/services/lmstudio-service.js';
import { FileInfo } from '../../../src/types/index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LMStudioService', () => {
  let lmstudioService: LMStudioService;

  beforeEach(() => {
    lmstudioService = new LMStudioService();
    vi.clearAllMocks();
  });

  describe('Constructor URL validation', () => {
    it('should throw when base URL points to a non-localhost host', () => {
      expect(() => new LMStudioService('http://example.com:1234')).toThrow('localhost');
    });

    it('should throw on an invalid URL format', () => {
      expect(() => new LMStudioService('not-a-url')).toThrow();
    });

    it('should not throw when base URL uses 127.0.0.1', () => {
      expect(() => new LMStudioService('http://127.0.0.1:1234')).not.toThrow();
    });
  });

  describe('generateFileName()', () => {
    it('should generate filename using OpenAI-compatible API', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'project-requirements-document',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 10,
          total_tokens: 60
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await lmstudioService.generateFileName(
        'This document contains project requirements and specifications.',
        'document.txt',
        'kebab-case',
        'document'
      );

      expect(result.name).toBe('project-requirements-document');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"model":"local-model"')
        })
      );
    });

    it('should include file metadata in the prompt', async () => {
      const mockFileInfo: FileInfo = {
        path: '/test/document.pdf',
        name: 'document.pdf',
        extension: '.pdf',
        size: 1024,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        parentFolder: 'contracts',
        folderPath: ['home', 'user', 'contracts'],
        documentMetadata: {
          title: 'Contract Agreement',
          author: 'John Doe',
          subject: 'Service Contract'
        }
      };

      const mockResponse = {
        choices: [{
          message: {
            content: 'service-contract-agreement-john-doe',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await lmstudioService.generateFileName(
        'Contract content here...',
        'document.pdf',
        'kebab-case',
        'document',
        mockFileInfo
      );

      expect(result.name).toBe('service-contract-agreement-john-doe');
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const userMessage = requestBody.messages.find((m: any) => m.role === 'user');
      
      expect(userMessage.content).toContain('- Title: Contract Agreement');
      expect(userMessage.content).toContain('- Author: John Doe');
      expect(userMessage.content).toContain('- Subject: Service Contract');
      expect(userMessage.content).toContain('- Parent folder: contracts');
    });

    it('should use proper OpenAI API parameters', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'test-filename',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await lmstudioService.generateFileName('content', 'file.txt');

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody).toMatchObject({
        model: 'local-model',
        temperature: 0.3,
        max_tokens: 100,
        stream: false
      });
      expect(requestBody.messages).toHaveLength(2); // system + user
      expect(requestBody.messages[0].role).toBe('system');
      expect(requestBody.messages[1].role).toBe('user');
    });

    it('should sanitize response content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '"Project Report.docx"',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await lmstudioService.generateFileName(
        'Report content',
        'report.docx',
        'kebab-case'
      );

      expect(result.name).toBe('project-report'); // Should remove quotes and extension
    });

    it('should strip Windows-illegal characters from AI suggestions', async () => {
      const illegalChars = [
        ['Contract: Q4 2024', 'contract--q4-2024'],
        ['Report? Final*', 'report--final-'],
        ['Invoice <2024>', 'invoice--2024-'],
        ['File|Name"Here', 'file-name-here'],
        ['Path\\Sub/Dir', 'path-sub-dir'],
      ] as const;

      for (const [input, expected] of illegalChars) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: input, role: 'assistant' }, finish_reason: 'stop' }]
          })
        });
        const result = await lmstudioService.generateFileName('content', 'file.txt', 'kebab-case');
        expect(result.name).toBe(expected);
      }
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error'
      });

      await expect(
        lmstudioService.generateFileName('content', 'file.txt')
      ).rejects.toThrow('LMStudio service failed');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        lmstudioService.generateFileName('content', 'file.txt')
      ).rejects.toThrow('LMStudio service failed');
    });

    it('should handle non-Error exceptions with unknown error message', async () => {
      // Throw a non-Error object to test the `error instanceof Error` false branch
      mockFetch.mockRejectedValueOnce('string error');

      await expect(
        lmstudioService.generateFileName('content', 'file.txt')
      ).rejects.toThrow('LMStudio service failed: Unknown error');
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await expect(
        lmstudioService.generateFileName('content', 'file.txt')
      ).rejects.toThrow('LMStudio service failed');
    });

    it('should handle missing choices in response', async () => {
      const mockResponse = {
        choices: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await expect(
        lmstudioService.generateFileName('content', 'file.txt')
      ).rejects.toThrow('LMStudio service failed');
    });

    it('should use custom base URL and model', async () => {
      const customService = new LMStudioService('http://localhost:8080', 'custom-model');

      const mockResponse = {
        choices: [{
          message: {
            content: 'test-filename',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await customService.generateFileName('content', 'file.txt');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('"model":"custom-model"')
        })
      );
    });
  });

  describe('isAvailable()', () => {
    it('should return true when service is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      const result = await lmstudioService.isAvailable();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:1234/v1/models');
    });

    it('should return false when service is not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      });

      const result = await lmstudioService.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await lmstudioService.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('listModels()', () => {
    it('should return list of model IDs', async () => {
      const mockResponse = {
        data: [
          { id: 'local-model-1', object: 'model', created: 123456, owned_by: 'lmstudio' },
          { id: 'local-model-2', object: 'model', created: 123457, owned_by: 'lmstudio' },
          { id: 'custom-model', object: 'model', created: 123458, owned_by: 'user' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await lmstudioService.listModels();

      expect(result).toEqual(['local-model-1', 'local-model-2', 'custom-model']);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:1234/v1/models');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      });

      const result = await lmstudioService.listModels();

      expect(result).toEqual([]);
    });

    it('should handle malformed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      });

      const result = await lmstudioService.listModels();

      expect(result).toEqual([]);
    });

    it('should return empty array when network error occurs', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await lmstudioService.listModels();
      expect(result).toEqual([]);
    });
  });

  describe('Vision (imageData param) handling', () => {
    it('should attempt vision API call when imageData is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'vacation-photo', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 8, total_tokens: 108 }
        })
      });

      const result = await lmstudioService.generateFileName(
        '', 'photo.jpg', 'kebab-case', 'photo', undefined, undefined, undefined,
        'data:image/jpeg;base64,/9j/fakedata'
      );

      expect(result.name).toBe('vacation-photo');
      // Verify fetch was called with multipart array content (not silently skipped)
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const userMsg = body.messages[1];
      expect(Array.isArray(userMsg.content)).toBe(true);
      expect(userMsg.content[0]).toMatchObject({ type: 'text' });
      expect(userMsg.content[1]).toMatchObject({
        type: 'image_url',
        image_url: { url: 'data:image/jpeg;base64,/9j/fakedata' }
      });
    });

    it('should use text path when imageData is undefined', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'text-document', role: 'assistant' }, finish_reason: 'stop' }]
        })
      });

      await lmstudioService.generateFileName('some text content', 'doc.txt');

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      // Text path: user message content is a string
      expect(typeof body.messages[1].content).toBe('string');
    });

    it('should propagate API error when model rejects vision request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Model does not support vision'
      });

      await expect(
        lmstudioService.generateFileName('', 'photo.jpg', 'kebab-case', 'photo', undefined, undefined, undefined, 'data:image/jpeg;base64,/9j/fake')
      ).rejects.toThrow('LMStudio service failed');
    });

    it('should throw when imageData has invalid format', async () => {
      await expect(
        lmstudioService.generateFileName('', 'photo.jpg', 'kebab-case', 'photo', undefined, undefined, undefined, 'notadataurl')
      ).rejects.toThrow('LMStudio service failed');
    });
  });

  describe('Token usage (always undefined for local provider)', () => {
    it('should return undefined inputTokens and outputTokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'local-document', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 }
        })
      });

      const result = await lmstudioService.generateFileName('content', 'file.txt');

      expect(result.name).toBe('local-document');
      expect(result.inputTokens).toBeUndefined();
      expect(result.outputTokens).toBeUndefined();
    });

    it('should return undefined tokens even when API returns usage data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'another-doc', role: 'assistant' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 200, completion_tokens: 20, total_tokens: 220 }
        })
      });

      const result = await lmstudioService.generateFileName('content', 'file.txt');

      expect(result.inputTokens).toBeUndefined();
      expect(result.outputTokens).toBeUndefined();
    });

  });

  describe('context parameter', () => {
    it('should pass context to prompt when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ choices: [{ message: { content: 'tax-return-2023' }, finish_reason: 'stop' }] })
      });
      await lmstudioService.generateFileName('Document content', 'doc.pdf', 'kebab-case', 'general', undefined, undefined, 'These are tax documents');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = body.messages.find((m: any) => m.role === 'user');
      expect(userMsg.content).toContain('User-provided context:');
      expect(userMsg.content).toContain('These are tax documents');
    });
  });
});