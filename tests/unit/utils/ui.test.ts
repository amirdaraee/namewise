import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  suppressStderr,
  restoreStderr,
  info,
  dim,
  success,
  warn,
  error,
  hint,
  section,
  rule,
  spinner,
  fileRow,
  renameStats
} from '../../../src/utils/ui.js';
import type { FileInfo, RenameResult } from '../../../src/types/index.js';

function makeFile(overrides: Partial<FileInfo> = {}): FileInfo {
  return {
    path: '/docs/report.pdf',
    name: 'report.pdf',
    extension: '.pdf',
    size: 1024,
    createdAt: new Date(),
    modifiedAt: new Date(),
    accessedAt: new Date(),
    parentFolder: 'docs',
    folderPath: ['docs'],
    ...overrides
  };
}

function makeResult(overrides: Partial<RenameResult> = {}): RenameResult {
  return {
    originalPath: '/docs/old-name.pdf',
    newPath: '/docs/new-name.pdf',
    suggestedName: 'new-name.pdf',
    success: true,
    ...overrides
  };
}

describe('stderr suppression', () => {
  afterEach(() => {
    restoreStderr();
  });

  it('suppressStderr replaces process.stderr.write with a no-op returning true', () => {
    const before = process.stderr.write;
    suppressStderr();
    expect(process.stderr.write).not.toBe(before);
    expect((process.stderr.write as any)('library noise')).toBe(true);
    restoreStderr();
  });

  it('suppressStderr is idempotent (second call is a no-op)', () => {
    suppressStderr();
    const suppressed = process.stderr.write;
    suppressStderr();
    expect(process.stderr.write).toBe(suppressed);
    restoreStderr();
  });

  it('restoreStderr restores a working write and is a no-op when not suppressed', () => {
    suppressStderr();
    restoreStderr();
    const restored = process.stderr.write;
    // Second restore without a prior suppress must not change anything
    restoreStderr();
    expect(process.stderr.write).toBe(restored);
  });
});

describe('core output helpers', () => {
  it('info logs the plain message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    info('plain message');
    expect(spy).toHaveBeenCalledWith('plain message');
    spy.mockRestore();
  });

  it('dim logs the message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    dim('secondary');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('secondary');
    spy.mockRestore();
  });

  it('success logs a ✓ line', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    success('all done');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('✓');
    expect(output).toContain('all done');
    spy.mockRestore();
  });

  it('warn logs a ! line via console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warn('careful');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('!');
    expect(output).toContain('careful');
    spy.mockRestore();
  });

  it('error logs a ✗ line via console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    error('it broke');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('✗');
    expect(output).toContain('it broke');
    spy.mockRestore();
  });

  it('hint logs an indented → suggestion', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    hint('try --dry-run');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('→');
    expect(output).toContain('try --dry-run');
    spy.mockRestore();
  });
});

describe('structural helpers', () => {
  it('section prints the title followed by a rule', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    section('Results');
    expect(spy).toHaveBeenCalledTimes(2);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Results');
    expect(output).toContain('─');
    spy.mockRestore();
  });

  it('rule prints a horizontal rule', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    rule();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('─'.repeat(56));
    spy.mockRestore();
  });
});

describe('spinner', () => {
  it('returns an ora instance with the given text and cyan color', () => {
    const s = spinner('working…');
    expect(s.text).toBe('working…');
    expect(s.color).toBe('cyan');
    expect(s.isSpinning).toBe(false);
  });
});

describe('fileRow', () => {
  it('prints ✗ with the error message when the result failed', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    fileRow(makeResult({ success: false, error: 'AI request failed' }));
    expect(spy).toHaveBeenCalledTimes(2);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('✗');
    expect(output).toContain('old-name.pdf');
    expect(output).toContain('AI request failed');
    spy.mockRestore();
  });

  it('prints only the ✗ line when the failed result has no error message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    fileRow(makeResult({ success: false, error: undefined }));
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('✗');
    spy.mockRestore();
  });

  it('prints a single ✓ line without arrow when the name is unchanged', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    fileRow(makeResult({ originalPath: '/docs/same.pdf', newPath: '/docs/same.pdf' }));
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('✓');
    expect(output).toContain('same.pdf');
    expect(output).not.toContain('→');
    spy.mockRestore();
  });

  it('prints original → new when the file was renamed', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    fileRow(makeResult());
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('✓');
    expect(output).toContain('old-name.pdf');
    expect(output).toContain('→');
    expect(output).toContain('new-name.pdf');
    spy.mockRestore();
  });

  it('truncates long names with an ellipsis', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const longOriginal = 'a'.repeat(40) + '.pdf';
    const longNew = 'b'.repeat(50) + '.pdf';
    fileRow(makeResult({ originalPath: `/docs/${longOriginal}`, newPath: `/docs/${longNew}` }));
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('…');
    expect(output).not.toContain(longOriginal);
    expect(output).not.toContain(longNew);
    spy.mockRestore();
  });
});

describe('renameStats', () => {
  it('prints cloud-provider stats with ms elapsed, failures, and token usage', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    renameStats({
      elapsed: 500,
      files: [
        makeFile({ path: '/d/a.pdf', name: 'a.pdf' }),
        makeFile({ path: '/d/b.pdf', name: 'b.pdf' }),
        makeFile({ path: '/d/c.txt', name: 'c.txt', extension: '.txt', size: 2048 })
      ],
      successCount: 2,
      failCount: 1,
      tokenUsage: { inputTokens: 1200, outputTokens: 340 },
      dryRun: false
    });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Renamed');
    expect(output).not.toContain('Would rename');
    expect(output).toContain('500ms');
    expect(output).toContain('2 PDF');
    expect(output).toContain('1 TXT');
    expect(output).toContain((1200).toLocaleString() + ' in');
    expect(output).toContain('340 out');
    spy.mockRestore();
  });

  it('prints dry-run stats with seconds elapsed and N/A tokens for local providers', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    renameStats({
      elapsed: 2500,
      files: [makeFile()],
      successCount: 1,
      failCount: 0,
      tokenUsage: {},
      dryRun: true
    });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Would rename');
    expect(output).toContain('2.5s');
    expect(output).toContain('N/A (local provider)');
    spy.mockRestore();
  });
});
