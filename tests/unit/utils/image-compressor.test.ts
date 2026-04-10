import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCanvas, loadImage } from 'canvas';

vi.mock('canvas', () => {
  const mockCtx = { drawImage: vi.fn() };
  const mockCanvas = {
    getContext: vi.fn().mockReturnValue(mockCtx),
    toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,/9j/smalldata')
  };
  return {
    createCanvas: vi.fn().mockReturnValue(mockCanvas),
    loadImage: vi.fn()
  };
});

vi.mock('heic-convert', () => ({
  default: vi.fn()
}));

describe('ImageCompressor', () => {
  let mockLoadImage: any;
  let mockCreateCanvas: any;
  let mockCanvas: any;
  let mockCtx: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const canvasMod = await import('canvas');
    mockLoadImage = vi.mocked(canvasMod.loadImage);
    mockCreateCanvas = vi.mocked(canvasMod.createCanvas);
    mockCtx = { drawImage: vi.fn() };
    mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,/9j/smalldata')
    };
    mockCreateCanvas.mockReturnValue(mockCanvas);
  });

  describe('compress() - resize logic', () => {
    it('should not resize if width and height are both ≤ 1024', async () => {
      mockLoadImage.mockResolvedValue({ width: 800, height: 600 });
      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');

      await ImageCompressor.compress(Buffer.from('fake'), 'image/jpeg');

      expect(mockCreateCanvas).toHaveBeenCalledWith(800, 600);
    });

    it('should resize landscape image so width = 1024 and height scales proportionally', async () => {
      mockLoadImage.mockResolvedValue({ width: 2048, height: 1024 });
      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');

      await ImageCompressor.compress(Buffer.from('fake'), 'image/jpeg');

      expect(mockCreateCanvas).toHaveBeenCalledWith(1024, 512);
    });

    it('should resize portrait image so height = 1024 and width scales proportionally', async () => {
      mockLoadImage.mockResolvedValue({ width: 768, height: 2048 });
      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');

      await ImageCompressor.compress(Buffer.from('fake'), 'image/jpeg');

      expect(mockCreateCanvas).toHaveBeenCalledWith(384, 1024);
    });

    it('should resize square image so both sides = 1024', async () => {
      mockLoadImage.mockResolvedValue({ width: 4000, height: 4000 });
      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');

      await ImageCompressor.compress(Buffer.from('fake'), 'image/jpeg');

      expect(mockCreateCanvas).toHaveBeenCalledWith(1024, 1024);
    });

    it('should not resize a small image (512x512)', async () => {
      mockLoadImage.mockResolvedValue({ width: 512, height: 512 });
      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');

      await ImageCompressor.compress(Buffer.from('fake'), 'image/jpeg');

      expect(mockCreateCanvas).toHaveBeenCalledWith(512, 512);
    });
  });

  describe('compress() - quality steps', () => {
    it('should return the data URL from the first quality step that fits under 5MB', async () => {
      mockLoadImage.mockResolvedValue({ width: 800, height: 600 });
      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');

      // Small data URL — well under 5MB
      mockCanvas.toDataURL.mockReturnValue('data:image/jpeg;base64,' + 'A'.repeat(100));

      const result = await ImageCompressor.compress(Buffer.from('fake'), 'image/jpeg');

      expect(result).toMatch(/^data:image\/jpeg;base64,/);
      // Only one toDataURL call needed (first quality step fit)
      expect(mockCanvas.toDataURL).toHaveBeenCalledTimes(1);
    });

    it('should try next quality step if first result is over 5MB', async () => {
      mockLoadImage.mockResolvedValue({ width: 800, height: 600 });
      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');

      // Simulate >5MB base64 string (each char ≈ 0.75 bytes, so need > 6.67M chars)
      const largeData = 'data:image/jpeg;base64,' + 'A'.repeat(7_000_000);
      const smallData = 'data:image/jpeg;base64,' + 'A'.repeat(100);

      mockCanvas.toDataURL
        .mockReturnValueOnce(largeData)  // quality 0.9 — too large
        .mockReturnValueOnce(smallData); // quality 0.7 — fits

      const result = await ImageCompressor.compress(Buffer.from('fake'), 'image/jpeg');

      expect(result).toBe(smallData);
      expect(mockCanvas.toDataURL).toHaveBeenCalledTimes(2);
    });

    it('should treat data URL with no comma as zero-length base64 (estimateSizeBytes fallback)', async () => {
      mockLoadImage.mockResolvedValue({ width: 100, height: 100 });
      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');

      // Return a string with no comma — the ?? '' branch fires and estimateSizeBytes returns 0
      mockCanvas.toDataURL.mockReturnValueOnce('no-comma-data-url');

      const result = await ImageCompressor.compress(Buffer.from('fake'), 'image/jpeg');

      // Still returns a result (size estimated as 0, under 5MB threshold)
      expect(result).toBe('no-comma-data-url');
    });

    it('should use last-resort half-dimension path when all quality steps exceed 5MB', async () => {
      mockLoadImage.mockResolvedValue({ width: 800, height: 600 });
      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');

      const largeData = 'data:image/jpeg;base64,' + 'A'.repeat(7_000_000);
      const lastResortData = 'data:image/jpeg;base64,' + 'A'.repeat(50);

      // 4 quality steps all too large, then last resort fits
      mockCanvas.toDataURL
        .mockReturnValueOnce(largeData)
        .mockReturnValueOnce(largeData)
        .mockReturnValueOnce(largeData)
        .mockReturnValueOnce(largeData)
        .mockReturnValueOnce(lastResortData);

      const result = await ImageCompressor.compress(Buffer.from('fake'), 'image/jpeg');

      expect(result).toBe(lastResortData);
      // Last resort call uses halved dimensions: 400×300
      expect(mockCreateCanvas).toHaveBeenLastCalledWith(400, 300);
    });
  });

  describe('compress() - HEIC decoding', () => {
    it('should decode HEIC buffer via heic-convert before loading', async () => {
      const heicConvertMod = await import('heic-convert');
      const mockHeicConvert = vi.mocked(heicConvertMod.default);
      const jpegBuffer = Buffer.from('fake-jpeg');
      mockHeicConvert.mockResolvedValue(jpegBuffer as any);
      mockLoadImage.mockResolvedValue({ width: 800, height: 600 });

      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');
      await ImageCompressor.compress(Buffer.from('heic-data'), 'image/heic');

      expect(mockHeicConvert).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'JPEG' })
      );
      expect(mockLoadImage).toHaveBeenCalledWith(jpegBuffer);
    });

    it('should also handle image/heif mime type as HEIC', async () => {
      const heicConvertMod = await import('heic-convert');
      const mockHeicConvert = vi.mocked(heicConvertMod.default);
      mockHeicConvert.mockResolvedValue(Buffer.from('jpeg') as any);
      mockLoadImage.mockResolvedValue({ width: 100, height: 100 });

      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');
      await ImageCompressor.compress(Buffer.from('heif-data'), 'image/heif');

      expect(mockHeicConvert).toHaveBeenCalled();
    });

    it('should load buffer directly for non-HEIC types', async () => {
      const heicConvertMod = await import('heic-convert');
      const mockHeicConvert = vi.mocked(heicConvertMod.default);
      mockLoadImage.mockResolvedValue({ width: 200, height: 200 });

      const { ImageCompressor } = await import('../../../src/utils/image-compressor.js');
      const inputBuffer = Buffer.from('png-data');
      await ImageCompressor.compress(inputBuffer, 'image/png');

      expect(mockHeicConvert).not.toHaveBeenCalled();
      expect(mockLoadImage).toHaveBeenCalledWith(inputBuffer);
    });
  });
});
