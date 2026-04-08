import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/fs-collect.js', () => ({
  collectFiles: vi.fn(),
  formatBytes: vi.fn((b: number) => `${b}B`)
}));
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return { ...actual, promises: { ...(actual as any).promises, stat: vi.fn() } };
});

import { collectFiles } from '../../../src/utils/fs-collect.js';
import { promises as fs } from 'fs';
import { computeOrganizeMappings } from '../../../src/utils/organize.js';

const refDate = new Date('2024-03-15T00:00:00Z');
const baseStat = { mtime: refDate, birthtime: refDate, size: 500 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.stat).mockResolvedValue(baseStat as any);
});

describe('computeOrganizeMappings() by ext', () => {
  it('maps pdf files to pdf/ subfolder', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/file.pdf']);
    const mappings = await computeOrganizeMappings('/dir', 'ext', false);
    expect(mappings).toHaveLength(1);
    expect(mappings[0].destPath).toContain('pdf');
    expect(mappings[0].destPath).toContain('file.pdf');
  });

  it('maps files with no extension to other/', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/Makefile']);
    const mappings = await computeOrganizeMappings('/dir', 'ext', false);
    expect(mappings[0].destPath).toContain('other');
  });

  it('skips files already in the correct subfolder', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/pdf/file.pdf']);
    const mappings = await computeOrganizeMappings('/dir', 'ext', false);
    expect(mappings).toHaveLength(0);
  });

  it('maps multiple extensions correctly', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/a.txt', '/dir/b.docx']);
    const mappings = await computeOrganizeMappings('/dir', 'ext', false);
    expect(mappings).toHaveLength(2);
    const txtMapping = mappings.find(m => m.sourcePath.endsWith('a.txt'))!;
    expect(txtMapping.destPath).toContain('txt');
    expect(txtMapping.reason).toBe('txt');
  });
});

describe('computeOrganizeMappings() by date', () => {
  it('maps files to YYYY/MM/ folder based on mtime', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/photo.jpg']);
    const mappings = await computeOrganizeMappings('/dir', 'date', false);
    expect(mappings[0].destPath).toContain('2024');
    expect(mappings[0].destPath).toContain('03');
  });
});

describe('computeOrganizeMappings() by size — edge cases', () => {
  it('defaults size to 0 when stat has no size property', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/empty.bin']);
    vi.mocked(fs.stat).mockResolvedValue({} as any); // no .size
    const mappings = await computeOrganizeMappings('/dir', 'size', false);
    expect(mappings[0].reason).toBe('small'); // 0 bytes < 1MB → small
  });
});

describe('computeOrganizeMappings() by size', () => {
  it('maps small files (<1MB) to small/', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/tiny.txt']);
    vi.mocked(fs.stat).mockResolvedValue({ ...baseStat, size: 500 } as any);
    const mappings = await computeOrganizeMappings('/dir', 'size', false);
    expect(mappings[0].reason).toBe('small');
  });

  it('maps medium files (1MB-50MB) to medium/', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/mid.pdf']);
    vi.mocked(fs.stat).mockResolvedValue({ ...baseStat, size: 5 * 1024 * 1024 } as any);
    const mappings = await computeOrganizeMappings('/dir', 'size', false);
    expect(mappings[0].reason).toBe('medium');
  });

  it('maps large files (>50MB) to large/', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/video.mp4']);
    vi.mocked(fs.stat).mockResolvedValue({ ...baseStat, size: 60 * 1024 * 1024 } as any);
    const mappings = await computeOrganizeMappings('/dir', 'size', false);
    expect(mappings[0].reason).toBe('large');
  });
});
