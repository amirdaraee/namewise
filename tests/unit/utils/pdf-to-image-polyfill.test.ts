import { describe, it, expect, vi } from 'vitest';

// This file tests the process.getBuiltinModule polyfill in pdf-to-image.ts.
// Since the optional native deps became lazy-loaded, the polyfill is installed
// on the first conversion call (inside loadConverter), not at import time.
//
// Because ES modules are cached after first import, the only way to re-run
// the module fresh is:
//   1. vi.resetModules()  — clears the module registry for this worker
//   2. vi.doMock()        — non-hoisted mock, registers before the next import
//   3. dynamic import()   — reimports the module fresh

describe('PDFToImageConverter — process.getBuiltinModule polyfill', () => {
  it('installs the polyfill on first conversion when process.getBuiltinModule is absent', async () => {
    const original = (process as any).getBuiltinModule;

    // Remove the native implementation so the polyfill condition is true
    delete (process as any).getBuiltinModule;

    try {
      vi.resetModules();

      // Register mocks for the native deps before reimporting
      vi.doMock('pdf-to-png-converter', () => ({ pdfToPng: vi.fn().mockResolvedValue([]) }));
      vi.doMock('canvas', () => ({
        loadImage: vi.fn(),
        createCanvas: vi.fn(),
        DOMMatrix: class {}
      }));

      const { PDFToImageConverter } = await import('../../../src/utils/pdf-to-image.js');

      // Not installed at import time — deps are lazy now
      expect((process as any).getBuiltinModule).toBeUndefined();

      // First conversion loads the deps and installs the polyfill; the empty
      // page list then makes the conversion itself fail, which is fine here.
      await expect(PDFToImageConverter.convertFirstPageToBase64(Buffer.from('%PDF-1.4')))
        .rejects.toThrow('No pages could be converted');

      expect(typeof (process as any).getBuiltinModule).toBe('function');

      // Success path: require('fs') works
      const fsModule = (process as any).getBuiltinModule('fs');
      expect(fsModule).toBeTruthy();

      // Error path: non-existent module → require throws → returns null
      const nullResult = (process as any).getBuiltinModule('this-module-does-not-exist-xyz');
      expect(nullResult).toBeNull();
    } finally {
      // Always restore the original so other test files are unaffected
      (process as any).getBuiltinModule = original;
      vi.resetModules();
    }
  });
});
