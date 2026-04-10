import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted to the top. Factory functions must NOT reference
// top-level variables declared in the test file (they are not yet initialized).
// Use vi.fn() directly inside factory.

vi.mock('pdf-to-png-converter', () => ({
  pdfToPng: vi.fn()
}));

vi.mock('canvas', () => ({
  DOMMatrix: class {}
}));

vi.mock('../../../src/utils/image-compressor.js', () => ({
  ImageCompressor: {
    compress: vi.fn().mockResolvedValue('data:image/jpeg;base64,mockedcompressed')
  }
}));

import { pdfToPng } from 'pdf-to-png-converter';
import { ImageCompressor } from '../../../src/utils/image-compressor.js';
import { PDFToImageConverter } from '../../../src/utils/pdf-to-image.js';

const mockPdfToPng = vi.mocked(pdfToPng);
const mockCompress = vi.mocked(ImageCompressor.compress);

describe('PDFToImageConverter (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompress.mockResolvedValue('data:image/jpeg;base64,mockedcompressed');
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

      await expect(
        PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'))
      ).rejects.toThrow('PDF to image conversion failed');
    });

    it('should call ImageCompressor.compress with PNG buffer and mime type', async () => {
      const fakePngContent = Buffer.from('fake png content');
      mockPdfToPng.mockResolvedValue([{ content: fakePngContent, name: 'page1', path: '' }]);

      const result = await PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'));

      expect(mockCompress).toHaveBeenCalledWith(fakePngContent, 'image/png');
      expect(result).toBe('data:image/jpeg;base64,mockedcompressed');
    });

    it('should return the result from ImageCompressor.compress', async () => {
      const fakePngContent = Buffer.from('fake png content');
      mockPdfToPng.mockResolvedValue([{ content: fakePngContent, name: 'page1', path: '' }]);
      mockCompress.mockResolvedValue('data:image/jpeg;base64,customresult');

      const result = await PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'));

      expect(result).toBe('data:image/jpeg;base64,customresult');
    });

    it('should cover non-Error catch branch (lines 111-112)', async () => {
      // Throw a plain string (not an Error) so the catch block takes the false branch
      // of both `error instanceof Error` checks.
      mockPdfToPng.mockRejectedValue('plain string error');

      await expect(
        PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'))
      ).rejects.toThrow('PDF to image conversion failed: Unknown error');
    });

    it('should wrap ImageCompressor errors in PDF conversion error', async () => {
      const fakePngContent = Buffer.from('fake png content');
      mockPdfToPng.mockResolvedValue([{ content: fakePngContent, name: 'page1', path: '' }]);
      mockCompress.mockRejectedValue(new Error('Compression failed'));

      await expect(
        PDFToImageConverter.convertFirstPageToBase64(Buffer.from('fake pdf'))
      ).rejects.toThrow('PDF to image conversion failed: Compression failed');
    });
  });
});
