import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';

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
    const {
      scale = 2.0, // Higher scale for better quality
      format = 'png',
      firstPageOnly = true
    } = options;

    try {
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        verbosity: 0, // Suppress console output
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      });
      
      const pdfDocument = await loadingTask.promise;
      
      // Get first page
      const page = await pdfDocument.getPage(1);
      
      // Get page viewport
      const viewport = page.getViewport({ scale });
      
      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // Render page to canvas
      const renderTask = page.render({
        canvasContext: context as any,
        viewport: viewport,
        canvas: canvas as any
      });
      
      await renderTask.promise;
      
      // Convert canvas to base64
      let dataUrl: string;
      if (format === 'png') {
        dataUrl = canvas.toDataURL('image/png');
      } else {
        dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      }
      
      // Clean up
      await pdfDocument.destroy();
      
      return dataUrl;
      
    } catch (error) {
      throw new Error(`PDF to image conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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