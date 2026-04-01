import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { AIProvider, Config, FileInfo } from '../../../src/types/index.js';

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

export async function createTempDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'namewise-test-'));
  return {
    dir,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    }
  };
}

export async function copyTestFile(filename: string, destDir: string): Promise<string> {
  const src = path.join(process.cwd(), 'tests', 'data', filename);
  const dest = path.join(destDir, filename);
  await fs.copyFile(src, dest);
  return dest;
}

// ---------------------------------------------------------------------------
// MockAIService — replaces tests/mocks/mock-ai-service.ts
// ---------------------------------------------------------------------------

export interface CapturedCall {
  content: string;
  originalName: string;
  namingConvention?: string;
  category?: string;
  fileInfo?: FileInfo;
}

export class MockAIService implements AIProvider {
  name = 'MockAI';

  private responses: Map<string, string> = new Map([
    ['default', 'project-requirements-document'],
    ['meeting', 'team-meeting-notes-march-2024'],
    ['report', 'quarterly-sales-report-q1-2024']
  ]);
  private shouldFail = false;
  private calls: CapturedCall[] = [];

  setResponse(key: string, value: string): void {
    this.responses.set(key, value);
  }

  /** Alias kept for backwards compatibility with unit tests. */
  setMockResponse(key: string, value: string): void {
    this.responses.set(key, value);
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  getCallCount(): number {
    return this.calls.length;
  }

  getCalls(): CapturedCall[] {
    return this.calls;
  }

  reset(): void {
    this.calls = [];
    this.shouldFail = false;
  }

  /** Alias kept for backwards compatibility with unit tests. */
  resetCallCount(): void {
    this.calls = [];
  }

  async generateFileName(
    content: string,
    originalName: string,
    namingConvention?: string,
    category?: string,
    fileInfo?: FileInfo
  ): Promise<string> {
    this.calls.push({ content, originalName, namingConvention, category, fileInfo });

    if (this.shouldFail) {
      throw new Error('Mock AI service failed');
    }

    const lower = content.toLowerCase();

    if (lower.includes('meeting') || lower.includes('attendees')) {
      return this.responses.get('meeting') ?? 'meeting-notes';
    }
    if (lower.includes('requirements') || lower.includes('project')) {
      return this.responses.get('default') ?? 'project-document';
    }
    if (lower.includes('report') || lower.includes('sales')) {
      return this.responses.get('report') ?? 'business-report';
    }

    return `renamed-${originalName.replace(/\.[^/.]+$/, '')}`;
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    aiProvider: 'claude',
    apiKey: 'test-key',
    maxFileSize: 10 * 1024 * 1024,
    supportedExtensions: ['.txt', '.pdf', '.docx', '.xlsx', '.md'],
    dryRun: true,
    namingConvention: 'kebab-case',
    templateOptions: {
      category: 'general',
      dateFormat: 'none'
    },
    ...overrides
  };
}

export function makeFileInfo(filePath: string, overrides: Partial<FileInfo> = {}): FileInfo {
  const name = path.basename(filePath);
  const extension = path.extname(filePath);
  const parentFolder = path.basename(path.dirname(filePath));
  const now = new Date();

  return {
    path: filePath,
    name,
    extension,
    size: 1024,
    createdAt: now,
    modifiedAt: now,
    accessedAt: now,
    parentFolder,
    folderPath: [parentFolder],
    ...overrides
  };
}
