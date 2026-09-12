import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['tests/integration/helpers/generate-fixtures.ts'],
    include: ['tests/**/*.test.{ts,js}'],
    exclude: ['node_modules', 'dist'],
    // Vitest defaults to 5s, which is too tight for the native PDF and canvas
    // decode paths on Windows CI runners. Nothing legitimate comes close: the
    // whole suite runs in a few seconds locally.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/**/*.d.ts'],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src')
    }
  }
});