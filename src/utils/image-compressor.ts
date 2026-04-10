import { createCanvas, loadImage, Image } from 'canvas';

export class ImageCompressor {
  private static readonly MAX_SIZE_BYTES = 5 * 1024 * 1024;
  private static readonly MAX_DIMENSION = 1024;

  /**
   * Compresses an image buffer to a base64 JPEG data URL under 5MB.
   * Resizes to max 1024px on the longest side first, then applies progressive
   * quality reduction. HEIC/HEIF inputs are decoded to JPEG before processing.
   */
  static async compress(buffer: Buffer, mimeType: string): Promise<string> {
    let workingBuffer = buffer;

    // Decode HEIC/HEIF to JPEG first (canvas cannot load HEIC natively)
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      const heicConvert = (await import('heic-convert')).default;
      workingBuffer = Buffer.from(
        await heicConvert({ buffer: workingBuffer, format: 'JPEG', quality: 1 })
      );
    }

    const img = await loadImage(workingBuffer);

    // Resize so the longest side is at most 1024px, preserving aspect ratio
    let { width, height } = img;
    if (width > this.MAX_DIMENSION || height > this.MAX_DIMENSION) {
      if (width >= height) {
        height = Math.round((height / width) * this.MAX_DIMENSION);
        width = this.MAX_DIMENSION;
      } else {
        width = Math.round((width / height) * this.MAX_DIMENSION);
        height = this.MAX_DIMENSION;
      }
    }

    // Progressive quality compression — return first result under 5MB
    const qualities = [0.9, 0.7, 0.5, 0.3];
    for (const quality of qualities) {
      const dataUrl = this.renderToDataUrl(img, width, height, quality);
      if (this.estimateSizeBytes(dataUrl) <= this.MAX_SIZE_BYTES) {
        return dataUrl;
      }
    }

    // Last resort: halve dimensions and compress at lowest quality
    return this.renderToDataUrl(img, Math.floor(width / 2), Math.floor(height / 2), 0.3);
  }

  private static renderToDataUrl(
    img: Image,
    width: number,
    height: number,
    quality: number
  ): string {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  private static estimateSizeBytes(dataUrl: string): number {
    const base64 = dataUrl.split(',')[1] ?? '';
    return Math.ceil(base64.length * 0.75);
  }
}
