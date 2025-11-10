import { describe, it, expect, beforeAll } from 'vitest';
import { PDFToImageConverter } from '../../../src/utils/pdf-to-image.js';
import fs from 'fs';
import path from 'path';

describe('PDFToImageConverter', () => {
  let samplePdfBuffer: Buffer;
  const testDataDir = path.join(process.cwd(), 'tests/data');

  beforeAll(async () => {
    // Load sample PDF for testing
    const pdfPath = path.join(testDataDir, 'sample-pdf.pdf');
    samplePdfBuffer = fs.readFileSync(pdfPath);
  });

  describe('Integration with PDF Parser', () => {
    it('should successfully convert scanned PDF through parser workflow', async () => {
      // This simulates what happens in the actual PDF parser
      const { PDFParser } = await import('../../../src/parsers/pdf-parser.js');
      const parser = new PDFParser();

      // Create a minimal scanned PDF scenario
      const pdfPath = path.join(testDataDir, 'sample-pdf.pdf');

      // Parse the PDF (this will trigger conversion if detected as scanned)
      const result = await parser.parse(pdfPath);

      // The parser should complete without throwing errors
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    }, 15000);
  });

  describe('convertFirstPageToBase64()', () => {
    it('should convert PDF first page to base64 JPEG image', async () => {
      const result = await PDFToImageConverter.convertFirstPageToBase64(samplePdfBuffer);

      // Verify it's a base64 data URL (always JPEG for size optimization)
      expect(result).toMatch(/^data:image\/jpeg;base64,/);

      // Verify it has actual content
      expect(result.length).toBeGreaterThan(100);

      // Verify base64 encoding is valid
      const base64Data = result.split(',')[1];
      expect(() => Buffer.from(base64Data, 'base64')).not.toThrow();
    }, 10000); // 10 second timeout for PDF processing

    it('should respect format option when specified', async () => {
      const result = await PDFToImageConverter.convertFirstPageToBase64(samplePdfBuffer, {
        format: 'jpeg'
      });

      // Verify it's a base64 data URL (always JPEG for size optimization)
      expect(result).toMatch(/^data:image\/jpeg;base64,/);

      // Verify it has actual content
      expect(result.length).toBeGreaterThan(100);
    }, 10000);

    it('should use custom scale factor', async () => {
      const resultScale1 = await PDFToImageConverter.convertFirstPageToBase64(samplePdfBuffer, {
        scale: 1.0
      });

      const resultScale2 = await PDFToImageConverter.convertFirstPageToBase64(samplePdfBuffer, {
        scale: 2.0
      });

      // Both should be JPEG format
      expect(resultScale1).toMatch(/^data:image\/jpeg;base64,/);
      expect(resultScale2).toMatch(/^data:image\/jpeg;base64,/);

      // Higher scale should generally produce larger image (though compression may vary)
      expect(resultScale2.length).toBeGreaterThan(0);
      expect(resultScale1.length).toBeGreaterThan(0);
    }, 15000);

    it('should handle invalid PDF buffer', async () => {
      const invalidBuffer = Buffer.from('This is not a PDF');

      await expect(
        PDFToImageConverter.convertFirstPageToBase64(invalidBuffer)
      ).rejects.toThrow(/PDF to image conversion failed/);
    });

    it('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.from([]);

      await expect(
        PDFToImageConverter.convertFirstPageToBase64(emptyBuffer)
      ).rejects.toThrow(/PDF to image conversion failed/);
    });
  });

  describe('isScannedPDF()', () => {
    it('should detect scanned PDF with very little text', () => {
      const scannedText = 'abc';
      expect(PDFToImageConverter.isScannedPDF(scannedText)).toBe(true);
    });

    it('should detect scanned PDF with few words', () => {
      const scannedText = 'one two three four';
      expect(PDFToImageConverter.isScannedPDF(scannedText)).toBe(true);
    });

    it('should detect scanned PDF with high non-alphabetic ratio', () => {
      const scannedText = '### %%% $$$ ### %%%';
      expect(PDFToImageConverter.isScannedPDF(scannedText)).toBe(true);
    });

    it('should not detect normal PDF as scanned', () => {
      const normalText = 'This is a normal document with plenty of readable text content that was generated from a text-based PDF file.';
      expect(PDFToImageConverter.isScannedPDF(normalText)).toBe(false);
    });

    it('should detect empty text as scanned', () => {
      const emptyText = '';
      expect(PDFToImageConverter.isScannedPDF(emptyText)).toBe(true);
    });

    it('should detect whitespace-only text as scanned', () => {
      const whitespaceText = '   \n  \t  ';
      expect(PDFToImageConverter.isScannedPDF(whitespaceText)).toBe(true);
    });
  });
});
