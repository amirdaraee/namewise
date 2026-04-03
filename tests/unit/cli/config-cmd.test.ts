import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'os';
import path from 'path';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      mkdir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined)
    }
  };
});

import { promises as fs } from 'fs';
import { configCommand } from '../../../src/cli/config-cmd.js';

const CONFIG_PATH = path.join(os.homedir(), '.namewise.json');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
});

describe('configCommand()', () => {
  describe('list', () => {
    it('prints "No config found" when config file is missing', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await configCommand('list');
      expect(spy).toHaveBeenCalledWith('No config found in ~/.namewise.json');
      spy.mockRestore();
    });

    it('prints all keys when config exists', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ provider: 'openai', case: 'snake_case' }) as any);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await configCommand('list');
      const output = spy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('provider');
      expect(output).toContain('openai');
      spy.mockRestore();
    });
  });

  describe('get', () => {
    it('throws when no key is provided', async () => {
      await expect(configCommand('get')).rejects.toThrow('Usage: namewise config get <key>');
    });

    it('throws on unknown key', async () => {
      await expect(configCommand('get', 'unknownKey')).rejects.toThrow('Unknown config key: unknownKey');
    });

    it('prints "(not set)" when key has no value', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}) as any);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await configCommand('get', 'provider');
      expect(spy).toHaveBeenCalledWith('(not set)');
      spy.mockRestore();
    });

    it('prints the value when key exists', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ provider: 'claude' }) as any);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await configCommand('get', 'provider');
      expect(spy).toHaveBeenCalledWith('claude');
      spy.mockRestore();
    });
  });

  describe('set', () => {
    it('throws when no key or value is provided', async () => {
      await expect(configCommand('set', 'provider')).rejects.toThrow('Usage: namewise config set <key> <value>');
    });

    it('throws on unknown key', async () => {
      await expect(configCommand('set', 'unknownKey', 'value')).rejects.toThrow('Unknown config key');
    });

    it('writes updated config to file', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}) as any);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await configCommand('set', 'provider', 'openai');
      expect(fs.writeFile).toHaveBeenCalledWith(
        CONFIG_PATH,
        expect.stringContaining('"provider": "openai"'),
        'utf-8'
      );
      spy.mockRestore();
    });

    it('coerces "true" string to boolean true', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}) as any);
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await configCommand('set', 'recursive', 'true');
      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(JSON.parse(written).recursive).toBe(true);
    });

    it('coerces numeric strings to numbers', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}) as any);
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await configCommand('set', 'concurrency', '5');
      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(JSON.parse(written).concurrency).toBe(5);
    });

    it('coerces "false" string to boolean false', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}) as any);
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await configCommand('set', 'recursive', 'false');
      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(JSON.parse(written).recursive).toBe(false);
    });
  });

  describe('unknown subcommand', () => {
    it('throws for unrecognized subcommand', async () => {
      await expect(configCommand('foo')).rejects.toThrow('Unknown subcommand: foo');
    });
  });
});
