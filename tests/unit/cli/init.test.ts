import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() } }));
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      readFile: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined)
    }
  };
});
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return { ...actual, default: { ...(actual as any).default, homedir: vi.fn().mockReturnValue('/home/testuser') } };
});

import { promises as fs } from 'fs';
import os from 'os';
import inquirer from 'inquirer';
import { initCommand } from '../../../src/cli/init.js';

const prompt = vi.mocked(inquirer.prompt) as ReturnType<typeof vi.fn>;

// Helper: queue a sequence of prompt answers
const queueAnswers = (...answers: Record<string, unknown>[]) => {
  answers.forEach(a => prompt.mockResolvedValueOnce(a));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
  vi.spyOn(process, 'cwd').mockReturnValue('/current/dir');
});

describe('initCommand()', () => {
  it('writes global config for claude with api key', async () => {
    queueAnswers(
      { scope: 'global' },
      { provider: 'claude' },
      { apiKey: 'sk-ant-abc' },
      { model: '' },
      { namingConvention: 'snake_case' },
      { language: '' },
      { dryRun: true },
      { personalName: 'alice' }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/home/testuser/.namewise.json',
      expect.stringContaining('"provider": "claude"'),
      'utf-8'
    );
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written).toMatchObject({ provider: 'claude', apiKey: 'sk-ant-abc', case: 'snake_case', dryRun: true, name: 'alice' });
    expect(written.model).toBeUndefined(); // blank model not stored
    expect(written.language).toBeUndefined(); // blank language not stored
  });

  it('writes project config when scope is project', async () => {
    queueAnswers(
      { scope: 'project' },
      { provider: 'openai' },
      { apiKey: 'sk-oai-xyz' },
      { model: 'gpt-4' },
      { namingConvention: 'kebab-case' },
      { language: '' },
      { dryRun: false },
      { personalName: '' }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/current/dir/.namewise.json',
      expect.any(String),
      'utf-8'
    );
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.model).toBe('gpt-4');
    expect(written.dryRun).toBeUndefined(); // false → not stored
    expect(written.name).toBeUndefined();   // blank → not stored
  });

  it('uses "OpenAI" label for openai provider', async () => {
    queueAnswers(
      { scope: 'global' },
      { provider: 'openai' },
      { apiKey: 'sk-oai' },
      { model: '' },
      { namingConvention: 'kebab-case' },
      { language: '' },
      { dryRun: false },
      { personalName: '' }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    const apiKeyPromptCall = prompt.mock.calls[2][0] as any[];
    expect(apiKeyPromptCall[0].message).toContain('OpenAI');
  });

  it('does not store apiKey when left blank', async () => {
    queueAnswers(
      { scope: 'global' },
      { provider: 'claude' },
      { apiKey: '' },
      { model: '' },
      { namingConvention: 'kebab-case' },
      { language: '' },
      { dryRun: false },
      { personalName: '' }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.apiKey).toBeUndefined();
  });

  it('asks for base URL for ollama and stores custom URL', async () => {
    queueAnswers(
      { scope: 'global' },
      { provider: 'ollama' },
      { baseUrl: 'http://remote:11434' },
      { model: '' },
      { namingConvention: 'kebab-case' },
      { language: '' },
      { dryRun: false },
      { personalName: '' }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.baseUrl).toBe('http://remote:11434');
  });

  it('does not store baseUrl when it equals the ollama default', async () => {
    queueAnswers(
      { scope: 'global' },
      { provider: 'ollama' },
      { baseUrl: 'http://localhost:11434' },
      { model: '' },
      { namingConvention: 'kebab-case' },
      { language: '' },
      { dryRun: false },
      { personalName: '' }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.baseUrl).toBeUndefined();
  });

  it('stores custom baseUrl for lmstudio and custom model', async () => {
    queueAnswers(
      { scope: 'global' },
      { provider: 'lmstudio' },
      { baseUrl: 'http://localhost:5678' },
      { model: 'mistral-7b' },
      { namingConvention: 'camelCase' },
      { language: '' },
      { dryRun: true },
      { personalName: '' }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.baseUrl).toBe('http://localhost:5678');
    expect(written.model).toBe('mistral-7b');
  });

  it('does not store lmstudio default baseUrl', async () => {
    queueAnswers(
      { scope: 'global' },
      { provider: 'lmstudio' },
      { baseUrl: 'http://localhost:1234' },
      { model: '' },
      { namingConvention: 'kebab-case' },
      { language: '' },
      { dryRun: false },
      { personalName: '' }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.baseUrl).toBeUndefined();
  });

  it('cancels when existing config found and user declines overwrite', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"provider":"claude"}' as any);
    queueAnswers(
      { scope: 'global' },
      { overwrite: false }
    );
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(spy.mock.calls.map(c => c[0]).join('\n')).toContain('Init cancelled.');
    spy.mockRestore();
  });

  it('continues when existing config found and user accepts overwrite', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"provider":"openai","case":"snake_case"}' as any);
    queueAnswers(
      { scope: 'global' },
      { overwrite: true },
      { provider: 'openai' },
      { apiKey: 'sk-new' },
      { model: '' },
      { namingConvention: 'snake_case' },
      { language: '' },
      { dryRun: false },
      { personalName: '' }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('prints --dry-run tip when dryRun is false', async () => {
    queueAnswers(
      { scope: 'global' },
      { provider: 'ollama' },
      { baseUrl: 'http://localhost:11434' },
      { model: '' },
      { namingConvention: 'kebab-case' },
      { language: '' },
      { dryRun: false },
      { personalName: '' }
    );
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('--dry-run');
    spy.mockRestore();
  });

  it('omits --dry-run tip when dryRun is true', async () => {
    queueAnswers(
      { scope: 'global' },
      { provider: 'ollama' },
      { baseUrl: 'http://localhost:11434' },
      { model: '' },
      { namingConvention: 'kebab-case' },
      { language: '' },
      { dryRun: true },
      { personalName: '' }
    );
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    const lines = spy.mock.calls.map(c => c[0]);
    const renameLine = lines.find(l => typeof l === 'string' && l.includes('namewise rename'));
    expect(renameLine).not.toContain('--dry-run');
    spy.mockRestore();
  });

  it('stores language when provided', async () => {
    queueAnswers(
      { scope: 'global' },
      { provider: 'claude' },
      { apiKey: 'sk-ant-abc' },
      { model: '' },
      { namingConvention: 'kebab-case' },
      { language: 'English' },
      { dryRun: false },
      { personalName: '' }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.language).toBe('English');
  });

  it('does not store language when left blank', async () => {
    queueAnswers(
      { scope: 'global' },
      { provider: 'claude' },
      { apiKey: 'sk-ant-abc' },
      { model: '' },
      { namingConvention: 'kebab-case' },
      { language: '' },
      { dryRun: false },
      { personalName: '' }
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.language).toBeUndefined();
  });
});
