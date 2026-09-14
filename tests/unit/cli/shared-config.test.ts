import { describe, it, expect } from 'vitest';
import { resolveStoredApiKey } from '../../../src/cli/shared-config.js';

describe('resolveStoredApiKey()', () => {
  // A key in .namewise.json belongs to the provider it was configured for.
  // Handing it to a different provider sends, for example, an Anthropic key to
  // whatever gateway --base-url happens to name.
  it('returns the stored key when it belongs to the selected provider', () => {
    expect(resolveStoredApiKey({ provider: 'claude', apiKey: 'sk-ant' }, 'claude'))
      .toEqual({ apiKey: 'sk-ant' });
  });

  it('withholds the stored key from a different provider', () => {
    const result = resolveStoredApiKey({ provider: 'claude', apiKey: 'sk-ant' }, 'openai');
    expect(result.apiKey).toBeUndefined();
  });

  it('reports which provider the withheld key was stored for', () => {
    const result = resolveStoredApiKey({ provider: 'claude', apiKey: 'sk-ant' }, '9router');
    expect(result.ignoredFrom).toBe('claude');
  });

  it('treats a config with no provider as claude, matching resolveProvider', () => {
    expect(resolveStoredApiKey({ apiKey: 'sk-ant' }, 'claude')).toEqual({ apiKey: 'sk-ant' });
    expect(resolveStoredApiKey({ apiKey: 'sk-ant' }, '9router').apiKey).toBeUndefined();
  });

  it('returns nothing when no key is stored', () => {
    expect(resolveStoredApiKey({ provider: 'claude' }, 'claude')).toEqual({});
    expect(resolveStoredApiKey({}, '9router')).toEqual({});
  });

  it('never reports an ignored provider when there is no key to ignore', () => {
    expect(resolveStoredApiKey({ provider: 'claude' }, 'openai').ignoredFrom).toBeUndefined();
  });
});
