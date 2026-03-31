import { describe, it, expect, vi } from 'vitest';

// This file tests the process.getBuiltinModule polyfill that lives at module
// initialisation time in pdf-to-image.ts (lines 11-20).
//
// Because ES modules are cached after first import, the only way to re-run
// module-level init code is:
//   1. vi.resetModules()  — clears the module registry for this worker
//   2. vi.doMock()        — non-hoisted mock, registers before the next import
//   3. dynamic import()   — reimports the module fresh

describe('PDFToImageConverter — process.getBuiltinModule polyfill', () => {
  it('installs the polyfill when process.getBuiltinModule is absent', async () => {
    const original = (process as any).getBuiltinModule;

    // Remove the native implementation so the polyfill condition is true
    delete (process as any).getBuiltinModule;

    try {
      vi.resetModules();

      // Register mocks for the native deps before reimporting
      vi.doMock('pdf-to-png-converter', () => ({ pdfToPng: vi.fn() }));
      vi.doMock('canvas', () => ({
        loadImage: vi.fn(),
        createCanvas: vi.fn(),
        DOMMatrix: class {}
      }));

      // Fresh import — module-level polyfill code runs now
      await import('../../../src/utils/pdf-to-image.js');

      // Polyfill should have been installed
      expect(typeof (process as any).getBuiltinModule).toBe('function');

      // Success path: require('fs') works → lines 14-15 covered
      const fsModule = (process as any).getBuiltinModule('fs');
      expect(fsModule).toBeTruthy();

      // Error path: non-existent module → require throws → lines 16-18 covered
      const nullResult = (process as any).getBuiltinModule('this-module-does-not-exist-xyz');
      expect(nullResult).toBeNull();
    } finally {
      // Always restore the original so other test files are unaffected
      (process as any).getBuiltinModule = original;
      vi.resetModules();
    }
  });
});
