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

      expect(result).toBe('project-requirements-document');
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

      expect(result).toBe('service-contract-agreement-john-doe');
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const userMessage = requestBody.messages.find((m: any) => m.role === 'user');
      
      expect(userMessage.content).toContain('Document title: "Contract Agreement"');
      expect(userMessage.content).toContain('Author: "John Doe"');
      expect(userMessage.content).toContain('Subject: "Service Contract"');
      expect(userMessage.content).toContain('Located in folder: "contracts"');
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
        lmstudioService.generateFileName('content', 'file.txt')
      ).rejects.toThrow('LMStudio service failed');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        lmstudioService.generateFileName('content', 'file.txt')
      ).rejects.toThrow('LMStudio service failed');
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
      const customService = new LMStudioService('http://custom:8080', 'custom-model');
      
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
        'http://custom:8080/v1/chat/completions',
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
  });
});