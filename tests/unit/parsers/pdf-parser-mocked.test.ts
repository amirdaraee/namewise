import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs - keep factory self-contained (no top-level variables)
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue(Buffer.from('fake pdf data'))
  }
}));

// Mock pdfjs-dist (legacy build used by the parser)
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: vi.fn()
}));

// Mock pdf-to-image utilities
vi.mock('../../../src/utils/pdf-to-image.js', () => ({
  PDFToImageConverter: {
    isScannedPDF: vi.fn(),
    convertFirstPageToBase64: vi.fn()
  }
}));

import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFParser } from '../../../src/parsers/pdf-parser.js';
import { PDFToImageConverter } from '../../../src/utils/pdf-to-image.js';
import { ParseError } from '../../../src/errors.js';

interface MockDocOptions {
  pages?: string[][];          // one array of text-item strings per page
  info?: unknown;              // getMetadata().info value
  metadataRejects?: boolean;   // make getMetadata() reject
  numPages?: number;           // override page count (defaults to pages.length)
  onGetPage?: () => void;      // side effect while extraction runs (noise tests)
  rawItems?: unknown[];        // raw textContent items for a single page
}

const mockGetDocument = vi.mocked(getDocument);

function mockPdfDocument(options: MockDocOptions = {}): { destroy: ReturnType<typeof vi.fn> } {
  const pages = options.pages ?? [['Normal text content from PDF file for testing purposes.']];
  const numPages = options.numPages ?? pages.length;
  const destroy = vi.fn().mockResolvedValue(undefined);

  const doc = {
    numPages,
    getMetadata: options.metadataRejects
      ? vi.fn().mockRejectedValue(new Error('no metadata stream'))
      : vi.fn().mockResolvedValue({ info: options.info }),
    getPage: vi.fn(async (pageNum: number) => {
      options.onGetPage?.();
      const items = options.rawItems ?? (pages[pageNum - 1] ?? []).map(str => ({ str }));
      return { getTextContent: vi.fn().mockResolvedValue({ items }) };
    })
  };

  mockGetDocument.mockReturnValue({ promise: Promise.resolve(doc), destroy } as any);
  return { destroy };
}

function mockPdfFailure(error: unknown): void {
  mockGetDocument.mockReturnValue({
    promise: Promise.reject(error),
    destroy: vi.fn()
  } as any);
}

describe('PDFParser (mocked)', () => {
  let parser: PDFParser;
  const mockIsScannedPDF = vi.mocked(PDFToImageConverter.isScannedPDF);
  const mockConvertFirstPageToBase64 = vi.mocked(PDFToImageConverter.convertFirstPageToBase64);

  beforeEach(() => {
    vi.clearAllMocks();
    parser = new PDFParser();

    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake pdf data'));
    mockIsScannedPDF.mockReturnValue(false);
    mockConvertFirstPageToBase64.mockResolvedValue('data:image/jpeg;base64,fakebase64');
    mockPdfDocument();
  });

  describe('Scanned PDF handling', () => {
    it('should convert scanned PDF and return imageData for the vision path', async () => {
      mockPdfDocument({ pages: [['short']] });
      mockIsScannedPDF.mockReturnValue(true);
      mockConvertFirstPageToBase64.mockResolvedValue('data:image/jpeg;base64,imagedata');

      const result = await parser.parse('/path/to/scanned.pdf');

      // imageData drives the vision path; content stays whatever sparse text was found
      expect(result.imageData).toBe('data:image/jpeg;base64,imagedata');
      expect(result.content).toBe('short'); // sparse extracted text is kept as extra context
      expect(mockConvertFirstPageToBase64).toHaveBeenCalled();
    });

    it('should continue with empty content when scanned PDF conversion fails with non-Error', async () => {
      mockPdfDocument({ pages: [[]] });
      mockIsScannedPDF.mockReturnValue(true);
      mockConvertFirstPageToBase64.mockRejectedValue('plain string error');

      const result = await parser.parse('/path/to/scanned.pdf');

      expect(result).toBeDefined();
      expect(result.content).toBe('');
    });

    it('should continue with empty content when scanned PDF conversion fails', async () => {
      mockPdfDocument({ pages: [[]] });
      mockIsScannedPDF.mockReturnValue(true);
      mockConvertFirstPageToBase64.mockRejectedValue(new Error('Conversion failed'));

      const result = await parser.parse('/path/to/scanned.pdf');

      expect(result).toBeDefined();
      expect(result.content).toBe('');
    });
  });

  describe('PDF text assembly', () => {
    it('should join text items with spaces and pages with blank lines', async () => {
      mockPdfDocument({
        pages: [
          ['First page', 'first line.'],
          ['Second page text.']
        ]
      });

      const result = await parser.parse('/path/to/multi.pdf');

      expect(result.content).toBe('First page first line.\n\nSecond page text.');
    });

    it('should treat items without a string str field as empty', async () => {
      mockPdfDocument({ rawItems: [{ str: 'hello' }, { somethingElse: true }, { str: 'world' }] });

      const result = await parser.parse('/path/to/odd-items.pdf');

      expect(result.content).toBe('hello  world');
    });

    it('should pass a standalone Uint8Array copy of the file to pdfjs', async () => {
      const raw = Buffer.from('fake pdf bytes here');
      vi.mocked(fs.readFileSync).mockReturnValue(raw);

      await parser.parse('/path/to/file.pdf');

      const arg = mockGetDocument.mock.calls[0][0] as { data: Uint8Array; verbosity: number };
      expect(arg.data).toBeInstanceOf(Uint8Array);
      expect(arg.data.buffer).not.toBe(raw.buffer);
      expect(Buffer.from(arg.data).toString()).toBe('fake pdf bytes here');
      expect(arg.verbosity).toBe(0);
    });

    it('should destroy the loading task after extraction', async () => {
      const { destroy } = mockPdfDocument();

      await parser.parse('/path/to/file.pdf');

      expect(destroy).toHaveBeenCalled();
    });
  });

  describe('PDF metadata extraction', () => {
    it('should extract metadata from PDF info', async () => {
      mockPdfDocument({
        pages: [
          ['This is a normal text-based PDF with sufficient words to avoid scanned detection.'],
          [''], [''], [''], ['']
        ],
        info: {
          Title: 'My PDF Title',
          Author: 'Jane Doe',
          Creator: 'Microsoft Word',
          Subject: 'Testing',
          CreationDate: 'D:20240315120000',
          ModDate: 'D:20240316'
        }
      });

      const result = await parser.parse('/path/to/document.pdf');

      expect(result.metadata.title).toBe('My PDF Title');
      expect(result.metadata.author).toBe('Jane Doe');
      expect(result.metadata.creator).toBe('Microsoft Word');
      expect(result.metadata.subject).toBe('Testing');
      expect(result.metadata.creationDate).toBeInstanceOf(Date);
      expect(result.metadata.modificationDate).toBeInstanceOf(Date);
      expect(result.metadata.pages).toBe(5);
    });

    it('should handle PDF with no metadata info', async () => {
      mockPdfDocument({ pages: [['Simple PDF content without metadata.']], info: undefined });

      const result = await parser.parse('/path/to/simple.pdf');

      expect(result.content).toBe('Simple PDF content without metadata.');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.title).toBeUndefined();
    });

    it('should handle getMetadata() rejection gracefully', async () => {
      mockPdfDocument({
        pages: [['Content of a PDF whose metadata stream cannot be read.']],
        metadataRejects: true
      });

      const result = await parser.parse('/path/to/broken-meta.pdf');

      expect(result.content).toBe('Content of a PDF whose metadata stream cannot be read.');
      expect(result.metadata.title).toBeUndefined();
    });

    it('should not set pages when the document reports zero pages', async () => {
      mockPdfDocument({ pages: [], numPages: 0, info: { Title: 'No Pages' } });
      mockIsScannedPDF.mockReturnValue(false);

      const result = await parser.parse('/path/to/document.pdf');

      expect(result.metadata.title).toBe('No Pages');
      expect(result.metadata.pages).toBeUndefined();
    });

    it('should calculate word count from text content', async () => {
      mockPdfDocument({ pages: [['one two three four five six seven eight nine ten']] });

      const result = await parser.parse('/path/to/file.pdf');

      expect(result.metadata.wordCount).toBe(10);
    });
  });

  describe('parseDate()', () => {
    it('should parse D: prefixed date format correctly', async () => {
      mockPdfDocument({
        pages: [['Some PDF text content here to avoid scanned PDF detection.']],
        info: { CreationDate: 'D:20240315120000' }
      });

      const result = await parser.parse('/path/to/file.pdf');

      const date = result.metadata.creationDate as Date;
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(2); // 0-based, March = index 2
      expect(date.getDate()).toBe(15);
    });

    it('should parse regular date strings', async () => {
      mockPdfDocument({
        pages: [['Some PDF text content here to avoid scanned PDF detection.']],
        info: { CreationDate: '2024-06-20T10:00:00.000Z' }
      });

      const result = await parser.parse('/path/to/file.pdf');

      expect(result.metadata.creationDate).toBeInstanceOf(Date);
    });

    it('should handle ModDate with D: format', async () => {
      mockPdfDocument({
        pages: [['Some PDF text content here to avoid scanned PDF detection.']],
        info: { ModDate: 'D:20240316' }
      });

      const result = await parser.parse('/path/to/file.pdf');

      expect(result.metadata.modificationDate).toBeInstanceOf(Date);
    });
  });

  describe('parseDate() error handling', () => {
    it('should return undefined when date value is a truthy non-string (triggers catch)', async () => {
      // A truthy non-string CreationDate causes dateStr.startsWith() to throw,
      // which is caught and returns undefined
      mockPdfDocument({
        pages: [['Some PDF text content here to avoid scanned PDF detection.']],
        info: { CreationDate: { year: 2024 } } // truthy object, not a string
      });

      const result = await parser.parse('/path/to/file.pdf');

      expect(result.metadata.creationDate).toBeUndefined();
    });
  });

  describe('Output suppression', () => {
    it('should swallow stderr and console.warn noise emitted during extraction', async () => {
      const warnSpy = vi.spyOn(console, 'warn');
      mockPdfDocument({
        pages: [['Normal text content from PDF file for testing purposes.']],
        onGetPage: () => {
          // Simulate pdfjs noise while the suppressors are active — this
          // invokes the no-op replacements installed by the parser.
          process.stderr.write('Warning: Setting up fake worker');
          console.warn('pdfjs warning noise');
        }
      });

      const result = await parser.parse('/path/to/noisy.pdf');

      expect(result.content).toContain('Normal text content');
      // The real console.warn (spied) must never have been reached
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should skip stderr restore when process.stderr.write is unavailable', async () => {
      const realWrite = process.stderr.write;
      (process.stderr as any).write = undefined;
      try {
        const result = await parser.parse('/path/to/document.pdf');
        expect(result.content).toContain('Normal text content');
      } finally {
        (process.stderr as any).write = realWrite;
      }
    });
  });

  describe('Error handling', () => {
    it('should re-throw typed ParseError without double-wrapping', async () => {
      mockPdfFailure(new ParseError('typed pdf error'));
      await expect(parser.parse('/path/to/typed.pdf')).rejects.toBeInstanceOf(ParseError);

      mockPdfFailure(new ParseError('typed pdf error'));
      await expect(parser.parse('/path/to/typed.pdf')).rejects.toThrow(/^typed pdf error$/);
    });

    it('should throw error when pdf loading fails', async () => {
      mockPdfFailure(new Error('Invalid PDF'));

      await expect(parser.parse('/path/to/invalid.pdf')).rejects.toThrow(
        'Failed to parse PDF: Invalid PDF'
      );
    });

    it('should handle non-Error exception with unknown error message', async () => {
      mockPdfFailure('string error');

      await expect(parser.parse('/path/to/file.pdf')).rejects.toThrow(
        'Failed to parse PDF: Unknown error'
      );
    });
  });
});
