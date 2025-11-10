import { pdfToPng } from 'pdf-to-png-converter';
import { createCanvas, loadImage, DOMMatrix } from 'canvas';

// Polyfill DOMMatrix for Node.js environments (required by pdf-to-png-converter)
if (typeof global !== 'undefined' && !global.DOMMatrix) {
  global.DOMMatrix = DOMMatrix as any;
}

export interface PDFToImageOptions {
  scale?: number;
  format?: 'png' | 'jpeg';
  firstPageOnly?: boolean;
}

export class PDFToImageConverter {
  // Claude's maximum image size is 5MB
  private static readonly MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

  static async convertFirstPageToBase64(
    pdfBuffer: Buffer,
    options: PDFToImageOptions = {}
  ): Promise<string> {
    const {
      scale = 2.0, // Higher scale for better quality (1-3 recommended)
      format = 'png'
    } = options;

    try {
      // Convert PDF to PNG using pdf-to-png-converter
      // This package handles all the canvas/image compatibility issues
      const pngPages = await pdfToPng(pdfBuffer as any, {
        disableFontFace: false,
        useSystemFonts: false,
        pagesToProcess: [1], // Only convert first page
        verbosityLevel: 0,
        viewportScale: scale
      });

      if (!pngPages || pngPages.length === 0) {
        throw new Error('No pages could be converted from PDF');
      }

      // Get the first page
      const firstPage = pngPages[0];

      if (!firstPage || !firstPage.content) {
        throw new Error('First page conversion failed');
      }

      // Load the PNG image for optimization
      const img = await loadImage(firstPage.content);

      // Always use JPEG for better compression and size control
      // Try different quality levels to fit under the size limit
      const qualities = [0.85, 0.7, 0.6, 0.5, 0.4, 0.3];

      for (const quality of qualities) {
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const sizeInBytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);

        if (sizeInBytes <= this.MAX_IMAGE_SIZE_BYTES) {
          return dataUrl;
        }
      }

      // If still too large, reduce dimensions
      const scaleFactor = 0.7;
      const newWidth = Math.floor(img.width * scaleFactor);
      const newHeight = Math.floor(img.height * scaleFactor);

      const canvas = createCanvas(newWidth, newHeight);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Try with reduced dimensions
      for (const quality of qualities) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const sizeInBytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);

        if (sizeInBytes <= this.MAX_IMAGE_SIZE_BYTES) {
          return dataUrl;
        }
      }

      // Last resort: heavily compressed small image
      const smallCanvas = createCanvas(Math.floor(newWidth * 0.5), Math.floor(newHeight * 0.5));
      const smallCtx = smallCanvas.getContext('2d');
      smallCtx.drawImage(img, 0, 0, smallCanvas.width, smallCanvas.height);

      return smallCanvas.toDataURL('image/jpeg', 0.3);

    } catch (error) {
      // Enhanced error logging for debugging
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