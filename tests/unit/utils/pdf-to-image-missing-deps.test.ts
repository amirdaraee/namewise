import { describe, it, expect, vi } from 'vitest';

// Simulate the optional native deps not being installed: dynamic imports
// inside PDFToImageConverter must reject.
vi.mock('pdf-to-png-converter', () => {
  throw new Error("Cannot find module 'pdf-to-png-converter'");
});
vi.mock('canvas', () => {
  throw new Error("Cannot find module 'canvas'");
});

import { PDFToImageConverter } from '../../../src/utils/pdf-to-image.js';
import { VisionError } from '../../../src/errors.js';

describe('PDFToImageConverter without optional deps installed', () => {
  it('throws VisionError instead of a raw module-not-found error', async () => {
    await expect(PDFToImageConverter.convertFirstPageToBase64(Buffer.from('%PDF-1.4')))
      .rejects.toBeInstanceOf(VisionError);
  });

  it('includes an actionable install hint', async () => {
    await expect(PDFToImageConverter.convertFirstPageToBase64(Buffer.from('%PDF-1.4')))
      .rejects.toMatchObject({
        hint: expect.stringContaining('npm install')
      });
  });
});
