import { describe, it, expect, vi } from 'vitest';

// Simulate `canvas` not being installed (it is an optionalDependency):
// the dynamic import inside ImageCompressor must reject.
vi.mock('canvas', () => {
  throw new Error("Cannot find module 'canvas'");
});

import { ImageCompressor } from '../../../src/utils/image-compressor.js';
import { VisionError } from '../../../src/errors.js';

describe('ImageCompressor without canvas installed', () => {
  it('throws VisionError instead of a raw module-not-found error', async () => {
    await expect(ImageCompressor.compress(Buffer.from('fake-image'), 'image/png'))
      .rejects.toBeInstanceOf(VisionError);
  });

  it('includes an actionable install hint', async () => {
    await expect(ImageCompressor.compress(Buffer.from('fake-image'), 'image/png'))
      .rejects.toMatchObject({
        message: expect.stringContaining('canvas'),
        hint: expect.stringContaining('npm install')
      });
  });
});
