import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted to the top. Factory functions must NOT reference
// top-level variables declared in the test file (they are not yet initialized).
// Use vi.fn() directly inside factory.

vi.mock('pdf-to-png-converter', () => ({
  pdfToPng: vi.fn()
}));

vi.mock('canvas', () => ({
  loadImage: vi.fn(),
  createCanvas: vi.fn(),
  DOMMatrix: class {}
}));

import { pdfToPng } from 'pdf-to-png-converter';
import { loadImage, createCanvas } from 'canvas';
import { PDFToImageConverter } from '../../../src/utils/pdf-to-image.js';

const mockPdfToPng = vi.mocked(pdfToPng);
const mockLoadImage = vi.mocked(loadImage);
const mockCreateCanvas = vi.mocked(createCanvas);

describe('PDFToImageConverter (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('convertFirstPageToBase64()', () => {
    it('should throw when pdfToPng returns empty array', async () => {
      mockPdfToPng.mockResolvedValue([]);

      await expect(
        PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'))
      ).rejects.toThrow('PDF to image conversion failed');
    });

    it('should throw when pdfToPng returns null/undefined page', async () => {
      mockPdfToPng.mockResolvedValue([null as any]);

      await expect(
        PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'))
      ).rejects.toThrow('PDF to image conversion failed');
    });

    it('should throw when first page has no content', async () => {
      mockPdfToPng.mockResolvedValue([{ content: null as any, name: 'page1', path: '' }]);
      mockLoadImage.mockResolvedValue({ width: 800, height: 600 } as any);

      await expect(
        PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'))
      ).rejects.toThrow('PDF to image conversion failed');
    });

    it('should return image data URL when image fits at quality 0.85', async () => {
      const fakePngContent = Buffer.from('fake png content');
      mockPdfToPng.mockResolvedValue([{ content: fakePngContent, name: 'page1', path: '' }]);

      const fakeImg = { width: 100, height: 100 };
      mockLoadImage.mockResolvedValue(fakeImg as any);

      // Small enough data URL to fit in 5MB limit
      const smallDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(100);
      const mockCtx = { drawImage: vi.fn() };
      const mockCanvasInstance = {
        getContext: vi.fn().mockReturnValue(mockCtx),
        toDataURL: vi.fn().mockReturnValue(smallDataUrl),
        width: 100,
        height: 100
      };
      mockCreateCanvas.mockReturnValue(mockCanvasInstance as any);

      const result = await PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'));

      expect(result).toBe(smallDataUrl);
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('should try quality reduction then return at 70% dimensions when full-size too large', async () => {
      const fakePngContent = Buffer.from('fake png content');
      mockPdfToPng.mockResolvedValue([{ content: fakePngContent, name: 'page1', path: '' }]);

      const fakeImg = { width: 1000, height: 1000 };
      mockLoadImage.mockResolvedValue(fakeImg as any);

      // Generate URLs of different sizes
      // 5MB = 5 * 1024 * 1024 bytes; base64 overhead: actual bytes = (base64.length - prefix.length) * 0.75
      // For large URL: need sizeInBytes > 5*1024*1024
      // sizeInBytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75)
      // > 5*1024*1024 = 5242880; so base64 chars > 5242880 / 0.75 + prefix = ~6990507 chars
      const prefix = 'data:image/jpeg;base64,';
      const largeBase64 = 'A'.repeat(7000000);
      const largeDataUrl = prefix + largeBase64;
      const smallBase64 = 'A'.repeat(100);
      const smallDataUrl = prefix + smallBase64;

      let callCount = 0;
      const mockCtx = { drawImage: vi.fn() };
      const mockCanvasInstance = {
        getContext: vi.fn().mockReturnValue(mockCtx),
        toDataURL: vi.fn().mockImplementation(() => {
          callCount++;
          // First 6 calls (quality loop at full size) return large; 7th+ return small
          return callCount <= 6 ? largeDataUrl : smallDataUrl;
        }),
        width: 700,
        height: 700
      };
      mockCreateCanvas.mockReturnValue(mockCanvasInstance as any);

      const result = await PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'));

      expect(result).toBe(smallDataUrl);
    });

    it('should cover non-Error catch branch (lines 111-112)', async () => {
      // Throw a plain string (not an Error) so the catch block takes the false branch
      // of both `error instanceof Error` checks (lines 111 and 112).
      mockPdfToPng.mockRejectedValue('plain string error');

      await expect(
        PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'))
      ).rejects.toThrow('PDF to image conversion failed: Unknown error');
    });

    it('should use last resort 50% dimensions when all quality loops fail', async () => {
      const fakePngContent = Buffer.from('fake png content');
      mockPdfToPng.mockResolvedValue([{ content: fakePngContent, name: 'page1', path: '' }]);

      const fakeImg = { width: 10000, height: 10000 };
      mockLoadImage.mockResolvedValue(fakeImg as any);

      const prefix = 'data:image/jpeg;base64,';
      // Always too large
      const largeDataUrl = prefix + 'A'.repeat(7000000);
      // Last resort URL
      const lastResortUrl = prefix + 'lastresort';

      let callCount = 0;
      const mockCtx = { drawImage: vi.fn() };
      const mockCanvasInstance = {
        getContext: vi.fn().mockReturnValue(mockCtx),
        toDataURL: vi.fn().mockImplementation(() => {
          callCount++;
          // First 12 calls (both 6-quality loops) return large; 13th = last resort
          return callCount <= 12 ? largeDataUrl : lastResortUrl;
        }),
        width: 5000,
        height: 5000
      };
      mockCreateCanvas.mockReturnValue(mockCanvasInstance as any);

      const result = await PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'));

      expect(result).toBe(lastResortUrl);
    });
  });
});
