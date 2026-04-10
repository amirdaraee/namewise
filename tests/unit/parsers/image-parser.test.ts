import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      readFile: vi.fn()
    }
  };
});

vi.mock('../../../src/utils/image-compressor.js', () => ({
  ImageCompressor: {
    compress: vi.fn().mockResolvedValue('data:image/jpeg;base64,compresseddata')
  }
}));

import { promises as fs } from 'fs';
import { ImageCompressor } from '../../../src/utils/image-compressor.js';

describe('ImageParser', () => {
  const fakeBuffer = Buffer.from('fake-image-bytes');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.readFile).mockResolvedValue(fakeBuffer as any);
  });

  describe('supports()', () => {
    it('should support .jpg', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      expect(new ImageParser().supports('photo.jpg')).toBe(true);
    });

    it('should support .jpeg', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      expect(new ImageParser().supports('photo.jpeg')).toBe(true);
    });

    it('should support .png', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      expect(new ImageParser().supports('screenshot.png')).toBe(true);
    });

    it('should support .gif', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      expect(new ImageParser().supports('animation.gif')).toBe(true);
    });

    it('should support .bmp', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      expect(new ImageParser().supports('bitmap.bmp')).toBe(true);
    });

    it('should support .tiff', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      expect(new ImageParser().supports('scan.tiff')).toBe(true);
    });

    it('should support .heic', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      expect(new ImageParser().supports('iphone.heic')).toBe(true);
    });

    it('should support .webp', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      expect(new ImageParser().supports('modern.webp')).toBe(true);
    });

    it('should be case-insensitive (.JPG, .PNG)', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      const parser = new ImageParser();
      expect(parser.supports('PHOTO.JPG')).toBe(true);
      expect(parser.supports('SCREENSHOT.PNG')).toBe(true);
    });

    it('should not support .pdf', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      expect(new ImageParser().supports('document.pdf')).toBe(false);
    });

    it('should not support .txt', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      expect(new ImageParser().supports('notes.txt')).toBe(false);
    });
  });

  describe('parse()', () => {
    it('should read the file and pass buffer + mime type to ImageCompressor', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      await new ImageParser().parse('/some/path/photo.jpg');

      expect(fs.readFile).toHaveBeenCalledWith('/some/path/photo.jpg');
      expect(ImageCompressor.compress).toHaveBeenCalledWith(fakeBuffer, 'image/jpeg');
    });

    it('should return ParseResult with imageData and empty content', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      const result = await new ImageParser().parse('/some/path/photo.jpg');

      expect(result.content).toBe('');
      expect(result.imageData).toBe('data:image/jpeg;base64,compresseddata');
      expect(result.metadata).toBeUndefined();
    });

    it('should pass correct mime type for .png files', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      await new ImageParser().parse('/path/screenshot.png');

      expect(ImageCompressor.compress).toHaveBeenCalledWith(fakeBuffer, 'image/png');
    });

    it('should pass correct mime type for .heic files', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      await new ImageParser().parse('/path/iphone.heic');

      expect(ImageCompressor.compress).toHaveBeenCalledWith(fakeBuffer, 'image/heic');
    });

    it('should pass correct mime type for .webp files', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      await new ImageParser().parse('/path/modern.webp');

      expect(ImageCompressor.compress).toHaveBeenCalledWith(fakeBuffer, 'image/webp');
    });

    it('should pass correct mime type for .gif files', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      await new ImageParser().parse('/path/anim.gif');

      expect(ImageCompressor.compress).toHaveBeenCalledWith(fakeBuffer, 'image/gif');
    });

    it('should pass correct mime type for .bmp files', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      await new ImageParser().parse('/path/bitmap.bmp');

      expect(ImageCompressor.compress).toHaveBeenCalledWith(fakeBuffer, 'image/bmp');
    });

    it('should pass correct mime type for .tiff files', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      await new ImageParser().parse('/path/scan.tiff');

      expect(ImageCompressor.compress).toHaveBeenCalledWith(fakeBuffer, 'image/tiff');
    });

    it('should throw when ImageCompressor throws (e.g. HEIC decode failure)', async () => {
      vi.mocked(ImageCompressor.compress).mockRejectedValueOnce(
        new Error('HEIC decode failed')
      );
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');

      await expect(new ImageParser().parse('/path/corrupt.heic')).rejects.toThrow(
        'HEIC decode failed'
      );
    });

    it('should fall back to image/jpeg mime type for unknown extension', async () => {
      const { ImageParser } = await import('../../../src/parsers/image-parser.js');
      await new ImageParser().parse('/path/unknown.raw');

      // The ?? 'image/jpeg' fallback is used for unknown extensions
      expect(ImageCompressor.compress).toHaveBeenCalledWith(fakeBuffer, 'image/jpeg');
    });
  });
});
