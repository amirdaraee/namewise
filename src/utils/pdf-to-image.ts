import { pdfToPng } from 'pdf-to-png-converter';
import { DOMMatrix } from 'canvas';
import { createRequire } from 'module';
import { ImageCompressor } from './image-compressor.js';

// Polyfill DOMMatrix for Node.js environments (required by pdf-to-png-converter)
if (typeof global !== 'undefined' && !global.DOMMatrix) {
  global.DOMMatrix = DOMMatrix as any;
}

// Polyfill process.getBuiltinModule for Node.js < 22.3.0
if (typeof process !== 'undefined' && !process.getBuiltinModule) {
  const require = createRequire(import.meta.url);
  (process as any).getBuiltinModule = (id: string) => {
    try {
      return require(id);
    } catch (error) {
      return null;
    }
  };
}

export interface PDFToImageOptions {
  scale?: number;
  format?: 'png' | 'jpeg';
  firstPageOnly?: boolean;
}

export class PDFToImageConverter {
  static async convertFirstPageToBase64(
    pdfBuffer: Buffer,
    options: PDFToImageOptions = {}
  ): Promise<string> {
    const { scale = 2.0 } = options;

    try {
      const pngPages = await pdfToPng(pdfBuffer as any, {
        disableFontFace: false,
        useSystemFonts: false,
        pagesToProcess: [1],
        verbosityLevel: 0,
        viewportScale: scale
      });

      if (!pngPages || pngPages.length === 0) {
        throw new Error('No pages could be converted from PDF');
      }

      const firstPage = pngPages[0];
      if (!firstPage || !firstPage.content) {
        throw new Error('First page conversion failed');
      }

      // Delegate all compression/resize logic to ImageCompressor
      return await ImageCompressor.compress(firstPage.content, 'image/png');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';

      console.error('PDF to image conversion detailed error:', {
        message: errorMessage,
        stack: errorStack,
        errorType: error?.constructor?.name
      });

      throw new Error(`PDF to image conversion failed: ${errorMessage}`);
    }
  }
  
  static isScannedPDF(extractedText: string): boolean {
    // Heuristics to detect scanned/image-only PDFs
    const textLength = extractedText.trim().length;
    const wordCount = extractedText.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    // Consider it scanned if:
    // - Very little text (< 50 characters)
    // - Very few words (< 10 words)
    // - High ratio of non-alphabetic characters
    const nonAlphaRatio = (extractedText.length - extractedText.replace(/[^a-zA-Z]/g, '').length) / Math.max(extractedText.length, 1);
    
    return textLength < 50 || wordCount < 10 || nonAlphaRatio > 0.9;
  }
}