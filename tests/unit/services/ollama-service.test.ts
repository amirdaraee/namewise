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

      expect(result).toBe('project-requirements-document');
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

      expect(result).toBe('service-contract-agreement-john-doe');
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const userMessage = requestBody.messages.find((m: any) => m.role === 'user');
      
      expect(userMessage.content).toContain('Document title: "Contract Agreement"');
      expect(userMessage.content).toContain('Author: "John Doe"');
      expect(userMessage.content).toContain('Subject: "Service Contract"');
      expect(userMessage.content).toContain('Located in folder: "contracts"');
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

      expect(result).toBe('project-report'); // Should remove quotes and extension
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
      const customService = new OllamaService('http://custom:8080', 'custom-model');
      
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
        'http://custom:8080/api/chat',
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
  });
});