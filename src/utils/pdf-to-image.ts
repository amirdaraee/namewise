import { createRequire } from 'module';
import { ImageCompressor } from './image-compressor.js';
import { VisionError } from '../errors.js';

export interface PDFToImageOptions {
  scale?: number;
  format?: 'png' | 'jpeg';
  firstPageOnly?: boolean;
}

// `pdf-to-png-converter` and `canvas` are optionalDependencies (native
// modules needing a build toolchain). They are loaded lazily so the CLI
// works without them everywhere except the scanned-PDF vision path.
async function loadConverter(): Promise<typeof import('pdf-to-png-converter')> {
  let canvasModule: typeof import('canvas');
  let converter: typeof import('pdf-to-png-converter');
  try {
    canvasModule = await import('canvas');
    converter = await import('pdf-to-png-converter');
  } catch (cause) {
    throw new VisionError(
      'Scanned-PDF processing requires the optional "canvas" and "pdf-to-png-converter" packages, which are not installed.',
      {
        hint: 'Install them with: npm install -g canvas pdf-to-png-converter (requires a C/C++ build toolchain). Text-based PDFs still work without them.',
        cause
      }
    );
  }

  // Polyfill DOMMatrix for Node.js environments (required by pdf-to-png-converter)
  if (typeof global !== 'undefined' && !global.DOMMatrix) {
    global.DOMMatrix = canvasModule.DOMMatrix as any;
  }

  // Polyfill process.getBuiltinModule for Node.js < 22.3.0
  if (typeof process !== 'undefined' && !process.getBuiltinModule) {
    const require = createRequire(import.meta.url);
    (process as any).getBuiltinModule = (id: string) => {
      try {
        return require(id);
      } catch {
        return null;
      }
    };
  }

  return converter;
}

export class PDFToImageConverter {
  static async convertFirstPageToBase64(
    pdfBuffer: Buffer,
    options: PDFToImageOptions = {}
  ): Promise<string> {
    const { scale = 2.0 } = options;
    const { pdfToPng } = await loadConverter();

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
      if (error instanceof VisionError) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`PDF to image conversion failed: ${errorMessage}`, { cause: error });
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
