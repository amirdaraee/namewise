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
      ).rejects.toThrow('Ollama service failed');
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
      ).rejects.toThrow('Ollama service failed');
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

  describe('Scanned PDF handling', () => {
    it('should use llava for scanned PDF when default model is not vision-capable', async () => {
      const mockResponse = {
        message: { content: 'scanned-doc', role: 'assistant' },
        done: true
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,/9j/fakedata';
      await ollamaService.generateFileName(scannedContent, 'scan.pdf');

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.model).toBe('llava');
      const userMsg = requestBody.messages.find((m: any) => m.role === 'user');
      expect(userMsg.images).toBeDefined();
      expect(Array.isArray(userMsg.images)).toBe(true);
    });

    it('should use current model when it is already a vision model', async () => {
      const visionService = new OllamaService('http://localhost:11434', 'llava:7b');
      const mockResponse = {
        message: { content: 'scanned-doc', role: 'assistant' },
        done: true
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,/9j/fakedata';
      await visionService.generateFileName(scannedContent, 'scan.pdf');

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.model).toBe('llava:7b');
    });

    it('should use llama3.2-vision model when current model contains it', async () => {
      const visionService = new OllamaService('http://localhost:11434', 'llama3.2-vision:latest');
      const mockResponse = {
        message: { content: 'scanned-doc', role: 'assistant' },
        done: true
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const scannedContent = '[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,/9j/fakedata';
      await visionService.generateFileName(scannedContent, 'scan.pdf');

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.model).toBe('llama3.2-vision:latest');
    });

    it('should strip base64 prefix and pass only raw base64 data as images array', async () => {
      const mockResponse = {
        message: { content: 'scanned-doc', role: 'assistant' },
        done: true
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const rawBase64 = 'ABCDEF123456';
      const scannedContent = `[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,${rawBase64}`;
      await ollamaService.generateFileName(scannedContent, 'scan.pdf');

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = requestBody.messages.find((m: any) => m.role === 'user');
      expect(userMsg.images[0]).toBe(rawBase64);
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
});