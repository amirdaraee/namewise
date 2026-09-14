import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NineRouterService } from '../../../src/services/ninerouter-service.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const KEY = 'nr-test-key';

const chatResponse = (content: string) => ({
  ok: true,
  json: async () => ({
    choices: [{ message: { content, role: 'assistant' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 40, completion_tokens: 8, total_tokens: 48 }
  })
});

describe('NineRouterService', () => {
  let service: NineRouterService;

  beforeEach(() => {
    service = new NineRouterService(KEY, undefined, 'glm/glm-5.1');
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('defaults to the 9Router port on localhost', async () => {
      mockFetch.mockResolvedValueOnce(chatResponse('quarterly-report'));
      await service.generateFileName('content', 'a.txt');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:20128/v1/chat/completions',
        expect.anything()
      );
    });

    it('rejects a non-localhost base URL', () => {
      expect(() => new NineRouterService(KEY, 'https://my-vps.example.com', 'glm/glm-5.1')).toThrow('localhost');
    });

    it('accepts 127.0.0.1', () => {
      expect(() => new NineRouterService(KEY, 'http://127.0.0.1:20128', 'glm/glm-5.1')).not.toThrow();
    });
  });

  describe('authentication', () => {
    it('sends the 9Router key as a bearer token', async () => {
      mockFetch.mockResolvedValueOnce(chatResponse('quarterly-report'));
      await service.generateFileName('content', 'a.txt');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${KEY}`
          }
        })
      );
    });

    it('authenticates isAvailable()', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await service.isAvailable();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:20128/v1/models',
        expect.objectContaining({
          headers: { Authorization: `Bearer ${KEY}` }
        })
      );
    });

    it('authenticates listModels()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'glm/glm-5.1' }, { id: 'minimax/m2.7' }] })
      });
      const models = await service.listModels();
      expect(models).toEqual(['glm/glm-5.1', 'minimax/m2.7']);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:20128/v1/models',
        expect.objectContaining({ headers: { Authorization: `Bearer ${KEY}` } })
      );
    });
  });

  describe('generateFileName()', () => {
    it('routes through the OpenAI-compatible chat endpoint with the routed model', async () => {
      mockFetch.mockResolvedValueOnce(chatResponse('project-requirements-document'));
      const result = await service.generateFileName('project requirements', 'doc.txt', 'kebab-case', 'document');
      expect(result.name).toBe('project-requirements-document');
      expect(mockFetch.mock.calls[0][1].body).toContain('"model":"glm/glm-5.1"');
    });

    it('reports token usage', async () => {
      mockFetch.mockResolvedValueOnce(chatResponse('quarterly-report'));
      const result = await service.generateFileName('content', 'a.txt');
      expect(result.inputTokens).toBe(40);
      expect(result.outputTokens).toBe(8);
    });

    it('sends image content through the vision branch', async () => {
      mockFetch.mockResolvedValueOnce(chatResponse('receipt-scan'));
      await service.generateFileName('', 'scan.jpg', 'kebab-case', 'photo', undefined, undefined, undefined,
        'data:image/jpeg;base64,AAAA');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[1].content).toEqual([
        { type: 'text', text: expect.any(String) },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }
      ]);
    });

    it('maps a 401 from the gateway to an auth error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'bad key' });
      await expect(service.generateFileName('content', 'a.txt')).rejects.toThrow(/authentication failed/i);
    });
  });

  describe('isAvailable()', () => {
    it('returns false when the gateway is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await service.isAvailable()).toBe(false);
    });

    it('returns false on a non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await service.isAvailable()).toBe(false);
    });
  });

  describe('listModels()', () => {
    it('returns an empty list when the gateway is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await service.listModels()).toEqual([]);
    });

    it('returns an empty list on a non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await service.listModels()).toEqual([]);
    });

    it('returns an empty list when the payload has no data array', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      expect(await service.listModels()).toEqual([]);
    });
  });
});
