import { promises as fs } from 'fs';
import path from 'path';
import { DocumentParser, ParseResult } from '../types/index.js';
import { ImageCompressor } from '../utils/image-compressor.js';

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.heic', '.webp'
]);

const MIME_TYPES: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.bmp':  'image/bmp',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.webp': 'image/webp',
};

export class ImageParser implements DocumentParser {
  supports(filePath: string): boolean {
    return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
  }

  async parse(filePath: string): Promise<ParseResult> {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] ?? 'image/jpeg';
    const buffer = await fs.readFile(filePath);
    const imageData = await ImageCompressor.compress(buffer, mimeType);
    return { content: '', imageData };
  }
}
