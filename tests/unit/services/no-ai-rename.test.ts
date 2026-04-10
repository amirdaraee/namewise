import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const mockExifrParse = vi.fn();
vi.mock('exifr', () => ({
  default: { parse: (...args: any[]) => mockExifrParse(...args) }
}));

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

const makeRenamer = (parserOverride?: any) => {
  const config = makeConfig({ noAi: true, dryRun: true });
  const ai = new MockAIService();
  const factory = parserOverride ?? new DocumentParserFactory(config);
  return { renamer: new FileRenamer(factory, ai, config), ai };
};

describe('FileRenamer with --no-ai', () => {

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

describe('--no-ai with image files (EXIF fallback)', () => {
  beforeEach(() => {
    mockExifrParse.mockReset();
  });

  it('uses EXIF ImageDescription when available', async () => {
    mockExifrParse.mockResolvedValue({ ImageDescription: 'Family vacation Paris' });

    const imageFactory = {
      getParser: vi.fn().mockReturnValue({
        parse: vi.fn().mockResolvedValue({
          content: '',
          imageData: 'data:image/jpeg;base64,fakedata'
        })
      })
    };

    const { renamer, ai } = makeRenamer(imageFactory);
    const file = makeFileInfo('/test/dir/IMG_1234.jpg', { size: 100 });
    const { results } = await renamer.renameFiles([file]);

    expect(ai.getCallCount()).toBe(0);
    expect(results[0].suggestedName.toLowerCase()).toContain('family');
  });

  it('uses EXIF UserComment when ImageDescription is absent', async () => {
    mockExifrParse.mockResolvedValue({ UserComment: 'Birthday party 2024' });

    const imageFactory = {
      getParser: vi.fn().mockReturnValue({
        parse: vi.fn().mockResolvedValue({
          content: '',
          imageData: 'data:image/jpeg;base64,fakedata'
        })
      })
    };

    const { renamer, ai } = makeRenamer(imageFactory);
    const file = makeFileInfo('/test/dir/IMG_5678.jpg', { size: 100 });
    const { results } = await renamer.renameFiles([file]);

    expect(ai.getCallCount()).toBe(0);
    expect(results[0].suggestedName.toLowerCase()).toContain('birthday');
  });

  it('uses DateTimeOriginal to produce photo-YYYY-MM-DD when description fields absent', async () => {
    mockExifrParse.mockResolvedValue({ DateTimeOriginal: new Date('2023-07-04T12:00:00') });

    const imageFactory = {
      getParser: vi.fn().mockReturnValue({
        parse: vi.fn().mockResolvedValue({
          content: '',
          imageData: 'data:image/jpeg;base64,fakedata'
        })
      })
    };

    const { renamer, ai } = makeRenamer(imageFactory);
    const file = makeFileInfo('/test/dir/IMG_9999.jpg', { size: 100 });
    const { results } = await renamer.renameFiles([file]);

    expect(ai.getCallCount()).toBe(0);
    expect(results[0].suggestedName.toLowerCase()).toContain('photo-2023-07-04');
  });

  it('falls back to filename stem when EXIF parse throws', async () => {
    mockExifrParse.mockRejectedValue(new Error('EXIF parse error'));

    const imageFactory = {
      getParser: vi.fn().mockReturnValue({
        parse: vi.fn().mockResolvedValue({
          content: '',
          imageData: 'data:image/jpeg;base64,fakedata'
        })
      })
    };

    const { renamer, ai } = makeRenamer(imageFactory);
    const file = makeFileInfo('/test/dir/beach-trip.jpg', { size: 100 });
    const { results } = await renamer.renameFiles([file]);

    expect(ai.getCallCount()).toBe(0);
    expect(results[0].suggestedName.toLowerCase()).toContain('beach');
  });

  it('falls back to filename stem when no EXIF data', async () => {
    mockExifrParse.mockResolvedValue(null);

    const imageFactory = {
      getParser: vi.fn().mockReturnValue({
        parse: vi.fn().mockResolvedValue({
          content: '',
          imageData: 'data:image/jpeg;base64,fakedata'
        })
      })
    };

    const { renamer, ai } = makeRenamer(imageFactory);
    const file = makeFileInfo('/test/dir/my-photo.jpg', { size: 100 });
    const { results } = await renamer.renameFiles([file]);

    expect(ai.getCallCount()).toBe(0);
    expect(results[0].suggestedName.toLowerCase()).toContain('my');
  });
});
