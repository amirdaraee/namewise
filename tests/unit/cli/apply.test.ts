import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      readFile: vi.fn(),
      access: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined)
    }
  };
});

vi.mock('../../../src/utils/history.js', () => ({
  appendHistory: vi.fn().mockResolvedValue(undefined)
}));

import { promises as fs } from 'fs';
import { appendHistory } from '../../../src/utils/history.js';
import { applyPlan } from '../../../src/cli/apply.js';

const validPlan = {
  results: [
    { originalPath: '/dir/old.pdf', newPath: '/dir/new.pdf', success: true }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validPlan) as any);
  vi.mocked(fs.access).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
});

describe('applyPlan()', () => {
  it('throws when plan file cannot be read', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    await expect(applyPlan('/missing/plan.json')).rejects.toThrow('Could not read plan file');
  });

  it('uses "Unknown error" when non-Error is thrown reading plan file', async () => {
    vi.mocked(fs.readFile).mockRejectedValue('string-error');
    await expect(applyPlan('/missing/plan.json')).rejects.toThrow('Could not read plan file: Unknown error');
  });

  it('throws when plan JSON has no results array', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ foo: 'bar' }) as any);
    await expect(applyPlan('/plan.json')).rejects.toThrow('Invalid plan file');
  });

  it('throws when source file does not exist', async () => {
    vi.mocked(fs.access).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
    await expect(applyPlan('/plan.json')).rejects.toThrow('Source file not found');
  });

  it('executes renames and appends to history', async () => {
    // source exists, target does not
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p) === '/dir/old.pdf') return;
      throw Object.assign(new Error(), { code: 'ENOENT' });
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await applyPlan('/plan.json');
    expect(fs.rename).toHaveBeenCalledWith('/dir/old.pdf', '/dir/new.pdf');
    expect(appendHistory).toHaveBeenCalled();
  });

  it('anchors relative plan paths to the plan directory, not the cwd', async () => {
    // Plans from older versions stored paths relative to the scanned directory
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      directory: '/scan/dir',
      results: [{ originalPath: 'old.pdf', newPath: 'new.pdf', success: true }]
    }) as any);
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p) === '/scan/dir/old.pdf') return;
      throw Object.assign(new Error(), { code: 'ENOENT' });
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await applyPlan('/plan.json');
    expect(fs.rename).toHaveBeenCalledWith('/scan/dir/old.pdf', '/scan/dir/new.pdf');
  });

  it('leaves relative paths untouched when the plan has no directory field', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      results: [{ originalPath: 'old.pdf', newPath: 'new.pdf', success: true }]
    }) as any);
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p) === 'old.pdf') return;
      throw Object.assign(new Error(), { code: 'ENOENT' });
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await applyPlan('/plan.json');
    expect(fs.rename).toHaveBeenCalledWith('old.pdf', 'new.pdf');
  });

  it('does not rename in dry-run mode', async () => {
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p) === '/dir/old.pdf') return;
      throw Object.assign(new Error(), { code: 'ENOENT' });
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await applyPlan('/plan.json', { dryRun: true });
    expect(fs.rename).not.toHaveBeenCalled();
    expect(appendHistory).not.toHaveBeenCalled();
  });

  it('prints "No renames to apply" when all results are unsuccessful', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      results: [{ originalPath: '/a.pdf', newPath: '/b.pdf', success: false }]
    }) as any);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await applyPlan('/plan.json');
    expect(spy).toHaveBeenCalledWith('No renames to apply.');
    spy.mockRestore();
  });

  it('throws when two plan entries share the same target path', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      results: [
        { originalPath: '/dir/a.pdf', newPath: '/dir/same.pdf', success: true },
        { originalPath: '/dir/b.pdf', newPath: '/dir/same.pdf', success: true }
      ]
    }) as any);
    // both source files exist
    vi.mocked(fs.access).mockResolvedValue(undefined);
    await expect(applyPlan('/plan.json')).rejects.toThrow(/Duplicate target in plan/);
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('throws when target path already exists', async () => {
    // both source and target exist
    vi.mocked(fs.access).mockResolvedValue(undefined);
    await expect(applyPlan('/plan.json')).rejects.toThrow('Target already exists');
  });

  it('re-throws non-ENOENT errors from target path access check', async () => {
    const permError = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p) === '/dir/old.pdf') return; // source exists
      throw permError; // target access throws non-ENOENT
    });
    await expect(applyPlan('/plan.json')).rejects.toThrow('Permission denied');
  });
});
