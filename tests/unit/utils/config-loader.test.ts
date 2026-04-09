import { describe, it, expect, beforeEach, vi } from 'vitest';
import os from 'os';
import path from 'path';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      readFile: vi.fn()
    }
  };
});

import { promises as fs } from 'fs';
import { loadConfig, NamiwiseFileConfig } from '../../../src/utils/config-loader.js';

describe('loadConfig()', () => {
  const mockReadFile = vi.mocked(fs.readFile);
  const homeDir = os.homedir();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty object when no config files exist', async () => {
    mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const result = await loadConfig('/some/dir');
    expect(result).toEqual({});
  });

  it('returns user config when only user config exists', async () => {
    const userConfig: NamiwiseFileConfig = { provider: 'openai', concurrency: 5 };
    mockReadFile.mockImplementation(async (fp: any) => {
      if (String(fp) === path.join(homeDir, '.namewise.json')) {
        return JSON.stringify(userConfig);
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    const result = await loadConfig('/some/dir');
    expect(result).toEqual(userConfig);
  });

  it('returns project config when only project config exists', async () => {
    const projectConfig: NamiwiseFileConfig = { case: 'snake_case' };
    mockReadFile.mockImplementation(async (fp: any) => {
      if (String(fp) === path.join('/some/dir', '.namewise.json')) {
        return JSON.stringify(projectConfig);
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    const result = await loadConfig('/some/dir');
    expect(result).toEqual(projectConfig);
  });

  it('project config overrides user config for shared keys', async () => {
    const userConfig: NamiwiseFileConfig = { provider: 'openai', concurrency: 5 };
    const projectConfig: NamiwiseFileConfig = { concurrency: 2 };
    mockReadFile.mockImplementation(async (fp: any) => {
      if (String(fp) === path.join(homeDir, '.namewise.json')) return JSON.stringify(userConfig);
      if (String(fp) === path.join('/some/dir', '.namewise.json')) return JSON.stringify(projectConfig);
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    const result = await loadConfig('/some/dir');
    expect(result.provider).toBe('openai');
    expect(result.concurrency).toBe(2);
  });

  it('throws a clear error on invalid JSON', async () => {
    mockReadFile.mockResolvedValueOnce('{ invalid json }');
    await expect(loadConfig('/some/dir')).rejects.toThrow('Invalid JSON');
  });

  it('throws and includes the file path in the error message', async () => {
    mockReadFile.mockImplementation(async (fp: any) => {
      if (String(fp) === path.join(homeDir, '.namewise.json')) return '{ bad json';
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    await expect(loadConfig('/some/dir')).rejects.toThrow(path.join(homeDir, '.namewise.json'));
  });

  it('should include context field when present in config file', async () => {
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify({ provider: 'claude', context: 'These are tax documents' }))
      .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const config = await loadConfig('/some/dir');
    expect(config.context).toBe('These are tax documents');
  });
});
