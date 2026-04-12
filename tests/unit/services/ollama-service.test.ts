import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaService } from '../../../src/services/ollama-service.js';
import { FileInfo } from '../../../src/types/index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaService', () => {
  let ollamaService: OllamaService;

  beforeEach(() => {
    ollamaService = new OllamaService();
    vi.clearAllMocks();
  });

  describe('Constructor URL validation', () => {
    it('should throw when base URL points to a non-localhost host', () => {
      expect(() => new OllamaService('http://example.com:11434')).toThrow('localhost');
    });

    it('should throw on an invalid URL format', () => {
      expect(() => new OllamaService('not-a-url')).toThrow();
    });

    it('should not throw when base URL uses 127.0.0.1', () => {
      expect(() => new OllamaService('http://127.0.0.1:11434')).not.toThrow();
    });
  });

  describe('generateFileName()', () => {
    it('should generate filename using Ollama chat API', async () => {
      const mockResponse = {
        message: {
          content: 'project-requirements-document',
          role: 'assistant'
        },
        done: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await ollamaService.generateFileName(
        'This document contains project requirements and specifications.',
        'document.txt',
        'kebab-case',
        'document'
      );

      expect(result.name).toBe('project-requirements-document');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"model":"llama3.1"')
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
        message: {
          content: 'service-contract-agreement-john-doe',
          role: 'assistant'
        },
        done: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await ollamaService.generateFileName(
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

    it('should sanitize response content', async () => {
      const mockResponse = {
        message: {
          content: '"Project Report.docx"',
          role: 'assistant'
        },
        done: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await ollamaService.generateFileName(
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
            message: { content: input, role: 'assistant' },
            done: true
          })
        });
        const result = await ollamaService.generateFileName('content', 'file.txt', 'kebab-case');
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
        ollamaService.generateFileName('content', 'file.txt')
      ).rejects.toThrow('Ollama API request failed: 500 Internal Server Error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        ollamaService.generateFileName('content', 'file.txt')
      ).rejects.toThrow('Ollama service failed');
    });

    it('should handle non-Error exceptions with unknown error message', async () => {
      // Throw a non-Error object to test the `error instanceof Error` false branch
      mockFetch.mockRejectedValueOnce('string error');

      await expect(
        ollamaService.generateFileName('content', 'file.txt')
      ).rejects.toThrow('Ollama service failed: Unknown error');
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        message: {
          content: '',
          role: 'assistant'
        },
        done: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await expect(
        ollamaService.generateFileName('content', 'file.txt')
      ).rejects.toThrow('No response content from Ollama');
    });

    it('should use custom base URL and model', async () => {
      const customService = new OllamaService('http://localhost:8080', 'custom-model');

      const mockResponse = {
        message: {
          content: 'test-filename',
          role: 'assistant'
        },
        done: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await customService.generateFileName('content', 'file.txt');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/chat',
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

      const result = await ollamaService.isAvailable();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
    });

    it('should return false when service is not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      });

      const result = await ollamaService.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ollamaService.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('listModels()', () => {
    it('should return list of model names', async () => {
      const mockResponse = {
        models: [
          { name: 'llama3.1' },
          { name: 'codellama' },
          { name: 'mistral' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await ollamaService.listModels();

      expect(result).toEqual(['llama3.1', 'codellama', 'mistral']);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      });

      const result = await ollamaService.listModels();

      expect(result).toEqual([]);
    });

    it('should handle malformed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      });

      const result = await ollamaService.listModels();

      expect(result).toEqual([]);
    });

    it('should return empty array when network error occurs', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await ollamaService.listModels();
      expect(result).toEqual([]);
    });
  });

  describe('Vision (imageData param) handling', () => {
    it('should use vision model and pass image data when imageData is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: 'vacation-photo', role: 'assistant' }, done: true })
      });

      const result = await ollamaService.generateFileName(
        '', 'photo.jpg', 'kebab-case', 'photo', undefined, undefined, undefined,
        'data:image/jpeg;base64,/9j/fakedata'
      );

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      // Should pass image data to the message
      expect(body.messages[1].images).toBeDefined();
      expect(body.messages[1].images[0]).toBe('/9j/fakedata');
      expect(result.name).toBe('vacation-photo');
    });

    it('should use text path when imageData is undefined', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: 'text-document', role: 'assistant' }, done: true })
      });

      await ollamaService.generateFileName('some text content', 'doc.txt');

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const userMessage = body.messages.find((m: any) => m.role === 'user');
      expect(userMessage.images).toBeUndefined();
    });

    it('should throw when imageData has invalid format', async () => {
      await expect(
        ollamaService.generateFileName('', 'photo.jpg', 'kebab-case', 'photo', undefined, undefined, undefined, 'notadataurl')
      ).rejects.toThrow('Invalid image data format');
    });
  });

  describe('Token usage (always undefined for local provider)', () => {
    it('should return undefined inputTokens and outputTokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3.1',
          message: { content: 'some-document', role: 'assistant' },
          done: true
        })
      });

      const result = await ollamaService.generateFileName('content', 'file.txt');

      expect(result.name).toBe('some-document');
      expect(result.inputTokens).toBeUndefined();
      expect(result.outputTokens).toBeUndefined();
    });
  });

  describe('context parameter', () => {
    it('should pass context to prompt when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ message: { content: 'tax-return-2023' }, done: true })
      });
      await ollamaService.generateFileName('Document content', 'doc.pdf', 'kebab-case', 'general', undefined, undefined, 'These are tax documents');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = body.messages.find((m: any) => m.role === 'user');
      expect(userMsg.content).toContain('User-provided context:');
      expect(userMsg.content).toContain('These are tax documents');
    });
  });
});