import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs - keep factory self-contained (no top-level variables)
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue(Buffer.from('fake pdf data'))
  }
}));

// Mock pdf-extraction
vi.mock('pdf-extraction', () => ({
  default: vi.fn()
}));

// Mock pdf-to-image utilities
vi.mock('../../../src/utils/pdf-to-image.js', () => ({
  PDFToImageConverter: {
    isScannedPDF: vi.fn(),
    convertFirstPageToBase64: vi.fn()
  }
}));

import fs from 'fs';
import { PDFParser } from '../../../src/parsers/pdf-parser.js';
import { PDFToImageConverter } from '../../../src/utils/pdf-to-image.js';

describe('PDFParser (mocked)', () => {
  let parser: PDFParser;
  const mockIsScannedPDF = vi.mocked(PDFToImageConverter.isScannedPDF);
  const mockConvertFirstPageToBase64 = vi.mocked(PDFToImageConverter.convertFirstPageToBase64);

  // Import pdf-extraction after mock is set up
  let mockPdfExtract: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    parser = new PDFParser();

    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake pdf data'));
    mockIsScannedPDF.mockReturnValue(false);
    mockConvertFirstPageToBase64.mockResolvedValue('data:image/jpeg;base64,fakebase64');

    // Get access to the mocked pdf-extraction module
    const pdfExtractionModule = await import('pdf-extraction');
    mockPdfExtract = vi.mocked(pdfExtractionModule.default);

    mockPdfExtract.mockResolvedValue({
      text: 'Normal text content from PDF file for testing purposes.',
      meta: {},
      numpages: 1
    });
  });

  describe('Scanned PDF handling', () => {
    it('should convert scanned PDF to image and prefix content', async () => {
      mockPdfExtract.mockResolvedValue({
        text: 'short',
        meta: {},
        numpages: 1
      });
      mockIsScannedPDF.mockReturnValue(true);
      mockConvertFirstPageToBase64.mockResolvedValue('data:image/jpeg;base64,imagedata');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await parser.parse('/path/to/scanned.pdf');

      expect(result.content).toBe('[SCANNED_PDF_IMAGE]:data:image/jpeg;base64,imagedata');
      expect(mockConvertFirstPageToBase64).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should continue with empty content when scanned PDF conversion fails with non-Error', async () => {
      // Exercises the `conversionError instanceof Error` false branch (line 36 of pdf-parser.ts)
      mockPdfExtract.mockResolvedValue({ text: '', meta: {}, numpages: 1 });
      mockIsScannedPDF.mockReturnValue(true);
      mockConvertFirstPageToBase64.mockRejectedValue('plain string error');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await parser.parse('/path/to/scanned.pdf');

      expect(result).toBeDefined();
      expect(result.content).toBe('');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PDF to image conversion failed'),
        'Unknown error'
      );

      warnSpy.mockRestore();
      logSpy.mockRestore();
    });

    it('should continue with empty content when scanned PDF conversion fails', async () => {
      mockPdfExtract.mockResolvedValue({
        text: '',
        meta: {},
        numpages: 1
      });
      mockIsScannedPDF.mockReturnValue(true);
      mockConvertFirstPageToBase64.mockRejectedValue(new Error('Conversion failed'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await parser.parse('/path/to/scanned.pdf');

      // Should continue with empty content (no throw)
      expect(result).toBeDefined();
      expect(result.content).toBe('');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PDF to image conversion failed'),
        'Conversion failed'
      );

      warnSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('PDF metadata extraction', () => {
    it('should extract metadata from PDF info', async () => {
      mockPdfExtract.mockResolvedValue({
        text: 'This is a normal text-based PDF with sufficient words to avoid scanned detection.',
        meta: {
          info: {
            Title: 'My PDF Title',
            Author: 'Jane Doe',
            Creator: 'Microsoft Word',
            Subject: 'Testing',
            CreationDate: 'D:20240315120000',
            ModDate: 'D:20240316'
          }
        },
        numpages: 5
      });

      mockIsScannedPDF.mockReturnValue(false);

      const result = await parser.parse('/path/to/document.pdf');

      expect(result.metadata.title).toBe('My PDF Title');
      expect(result.metadata.author).toBe('Jane Doe');
      expect(result.metadata.creator).toBe('Microsoft Word');
      expect(result.metadata.subject).toBe('Testing');
      expect(result.metadata.creationDate).toBeInstanceOf(Date);
      expect(result.metadata.modificationDate).toBeInstanceOf(Date);
      expect(result.metadata.pages).toBe(5);
    });

    it('should handle PDF with no metadata', async () => {
      mockPdfExtract.mockResolvedValue({
        text: 'Simple PDF content without metadata.',
        meta: null,
        numpages: 1
      });

      mockIsScannedPDF.mockReturnValue(false);

      const result = await parser.parse('/path/to/simple.pdf');

      expect(result.content).toBe('Simple PDF content without metadata.');
      expect(result.metadata).toBeDefined();
    });

    it('should calculate word count from text content', async () => {
      mockPdfExtract.mockResolvedValue({
        text: 'one two three four five six seven eight nine ten',
        meta: {},
        numpages: 1
      });

      mockIsScannedPDF.mockReturnValue(false);

      const result = await parser.parse('/path/to/file.pdf');

      expect(result.metadata.wordCount).toBe(10);
    });
  });

  describe('parseDate()', () => {
    it('should parse D: prefixed date format correctly', async () => {
      mockPdfExtract.mockResolvedValue({
        text: 'Some PDF text content here to avoid scanned PDF detection.',
        meta: {
          info: {
            CreationDate: 'D:20240315120000'
          }
        },
        numpages: 1
      });
      mockIsScannedPDF.mockReturnValue(false);

      const result = await parser.parse('/path/to/file.pdf');

      const date = result.metadata.creationDate as Date;
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(2); // 0-based, March = index 2
      expect(date.getDate()).toBe(15);
    });

    it('should parse regular date strings', async () => {
      mockPdfExtract.mockResolvedValue({
        text: 'Some PDF text content here to avoid scanned PDF detection.',
        meta: {
          info: {
            CreationDate: '2024-06-20T10:00:00.000Z'
          }
        },
        numpages: 1
      });
      mockIsScannedPDF.mockReturnValue(false);

      const result = await parser.parse('/path/to/file.pdf');

      expect(result.metadata.creationDate).toBeInstanceOf(Date);
    });

    it('should handle ModDate with D: format', async () => {
      mockPdfExtract.mockResolvedValue({
        text: 'Some PDF text content here to avoid scanned PDF detection.',
        meta: {
          info: {
            ModDate: 'D:20240316'
          }
        },
        numpages: 1
      });
      mockIsScannedPDF.mockReturnValue(false);

      const result = await parser.parse('/path/to/file.pdf');

      expect(result.metadata.modificationDate).toBeInstanceOf(Date);
    });
  });

  describe('parseDate() error handling', () => {
    it('should return undefined when date value is a truthy non-string (triggers catch)', async () => {
      // A truthy non-string CreationDate causes dateStr.startsWith() to throw,
      // which is caught and returns undefined (covering lines 95-97 of pdf-parser.ts)
      mockPdfExtract.mockResolvedValue({
        text: 'Some PDF text content here to avoid scanned PDF detection.',
        meta: {
          info: {
            CreationDate: { year: 2024 } // truthy object, not a string
          }
        },
        numpages: 1
      });
      mockIsScannedPDF.mockReturnValue(false);

      const result = await parser.parse('/path/to/file.pdf');

      // The parse should succeed but creationDate should be undefined (error caught)
      expect(result.metadata.creationDate).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should throw error when pdf-extraction fails', async () => {
      mockPdfExtract.mockRejectedValue(new Error('Invalid PDF'));

      await expect(parser.parse('/path/to/invalid.pdf')).rejects.toThrow(
        'Failed to parse PDF file: Invalid PDF'
      );
    });

    it('should handle non-Error exception with unknown error message', async () => {
      mockPdfExtract.mockRejectedValue('string error');

      await expect(parser.parse('/path/to/file.pdf')).rejects.toThrow(
        'Failed to parse PDF file: Unknown error'
      );
    });
  });
});
