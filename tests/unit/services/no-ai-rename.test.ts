import { describe, it, expect, vi } from 'vitest';
import { FileRenamer } from '../../../src/services/file-renamer.js';
import { makeConfig, makeFileInfo, MockAIService } from '../../integration/helpers/harness.js';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      rename: vi.fn().mockResolvedValue(undefined),
      access: vi.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }))
    }
  };
});

vi.mock('../../../src/parsers/factory.js', () => ({
  DocumentParserFactory: vi.fn().mockImplementation(() => ({
    getParser: vi.fn().mockReturnValue({
      parse: vi.fn().mockResolvedValue({
        content: 'some document content',
        metadata: { title: 'My Document Title', author: 'John Doe', creationDate: new Date('2024-03-15') }
      })
    })
  }))
}));

import { DocumentParserFactory } from '../../../src/parsers/factory.js';

describe('FileRenamer with --no-ai', () => {
  const makeRenamer = (parserOverride?: any) => {
    const config = makeConfig({ noAi: true, dryRun: true });
    const ai = new MockAIService();
    const factory = parserOverride ?? new DocumentParserFactory(config);
    return { renamer: new FileRenamer(factory, ai, config), ai };
  };

  it('uses document title from metadata when available', async () => {
    const { renamer, ai } = makeRenamer();
    const file = makeFileInfo('/test/dir/document.pdf', { size: 100 });
    const { results } = await renamer.renameFiles([file]);
    expect(ai.getCallCount()).toBe(0);
    expect(results[0].suggestedName.toLowerCase()).toContain('my');
  });

  it('falls back to author + year when no title is present', async () => {
    const noTitleFactory = {
      getParser: vi.fn().mockReturnValue({
        parse: vi.fn().mockResolvedValue({
          content: 'content',
          metadata: { author: 'Jane Smith', creationDate: new Date('2023-06-01') }
        })
      })
    };

    const { renamer, ai } = makeRenamer(noTitleFactory);
    const file = makeFileInfo('/test/dir/document.pdf', { size: 100 });
    const { results } = await renamer.renameFiles([file]);
    expect(ai.getCallCount()).toBe(0);
    expect(results[0].suggestedName.toLowerCase()).toContain('jane');
  });

  it('falls back to author only when no title or creationDate is present', async () => {
    const authorOnlyFactory = {
      getParser: vi.fn().mockReturnValue({
        parse: vi.fn().mockResolvedValue({
          content: 'content',
          metadata: { author: 'Bob Brown' }
        })
      })
    };

    const { renamer, ai } = makeRenamer(authorOnlyFactory);
    const file = makeFileInfo('/test/dir/document.pdf', { size: 100 });
    const { results } = await renamer.renameFiles([file]);
    expect(ai.getCallCount()).toBe(0);
    expect(results[0].suggestedName.toLowerCase()).toContain('bob');
  });

  it('falls back to filename stem when no metadata exists', async () => {
    const noMetaFactory = {
      getParser: vi.fn().mockReturnValue({
        parse: vi.fn().mockResolvedValue({ content: 'content', metadata: {} })
      })
    };

    const { renamer, ai } = makeRenamer(noMetaFactory);
    const file = makeFileInfo('/test/dir/my_original_file.pdf', { size: 100 });
    const { results } = await renamer.renameFiles([file]);
    expect(ai.getCallCount()).toBe(0);
    expect(results[0].suggestedName.toLowerCase()).toContain('original');
  });

  it('still calls AI when noAi is false', async () => {
    const config = makeConfig({ noAi: false, dryRun: true });
    const ai = new MockAIService();
    const factory = new DocumentParserFactory(config);
    const renamer = new FileRenamer(factory, ai, config);
    const file = makeFileInfo('/test/dir/document.pdf', { size: 100 });
    await renamer.renameFiles([file]);
    expect(ai.getCallCount()).toBe(1);
  });
});
