/**
 * Minimal shapes for the optionalDependencies `canvas` and
 * `pdf-to-png-converter`.
 *
 * Both are native modules. npm silently skips an optional dependency whose
 * engines do not match or whose prebuilt binary is unavailable, and because the
 * code referred to their real types (`typeof import('canvas')`), a skipped
 * install became a hard `tsc` failure — `TS2307: Cannot find module 'canvas'`.
 * That broke every Node 20 job before the floor moved, and still surfaces
 * intermittently on macOS runners when a prebuilt binary is missing.
 *
 * Describing only the surface we actually use keeps the build independent of
 * whether either package is installed. The runtime is unchanged: both are still
 * loaded through `await import()` inside a try/catch that raises a VisionError
 * telling the user how to install them.
 */

/** Decoded bitmap returned by canvas's `loadImage`. */
export interface CanvasImage {
  readonly width: number;
  readonly height: number;
}

export interface Canvas2DContext {
  drawImage(image: CanvasImage, dx: number, dy: number, dWidth: number, dHeight: number): void;
}

export interface CanvasSurface {
  getContext(contextId: '2d'): Canvas2DContext;
  toDataURL(mimeType: 'image/jpeg', quality: number): string;
}

/** The slice of the `canvas` module namewise uses. */
export interface CanvasModule {
  loadImage(source: Buffer): Promise<CanvasImage>;
  createCanvas(width: number, height: number): CanvasSurface;
  /** Polyfilled onto globalThis for pdf-to-png-converter's benefit. */
  DOMMatrix: unknown;
}

export interface PdfPngPage {
  content: Buffer;
}

export interface PdfToPngOptions {
  disableFontFace?: boolean;
  useSystemFonts?: boolean;
  pagesToProcess?: number[];
  verbosityLevel?: number;
  viewportScale?: number;
}

/** The slice of the `pdf-to-png-converter` module namewise uses. */
export interface PdfToPngModule {
  pdfToPng(pdf: Buffer, options?: PdfToPngOptions): Promise<PdfPngPage[]>;
}
