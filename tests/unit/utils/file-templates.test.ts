import { describe, it, expect } from 'vitest';
import {
  categorizeFile,
  applyTemplate,
  getTemplateInstructions,
  FILE_TEMPLATES,
  FileCategory
} from '../../../src/utils/file-templates.js';
import { FileInfo } from '../../../src/types/index.js';

describe('File Templates', () => {
  describe('categorizeFile()', () => {
    it('should categorize document files', () => {
      expect(categorizeFile('/path/contract.pdf')).toBe('document');
      expect(categorizeFile('/path/license.docx')).toBe('document');
      expect(categorizeFile('/path/certificate.txt')).toBe('document');
    });

    it('should categorize document files by content', () => {
      expect(categorizeFile('/path/file.pdf', 'This is a work contract agreement')).toBe('document');
      expect(categorizeFile('/path/file.pdf', 'License application form')).toBe('document');
      expect(categorizeFile('/path/file.pdf', 'Invoice for services rendered')).toBe('document');
    });

    it('should categorize movie files', () => {
      expect(categorizeFile('/path/movie.mp4')).toBe('movie');
      expect(categorizeFile('/path/film.mkv')).toBe('movie');
      expect(categorizeFile('/path/video.avi')).toBe('movie');
    });

    it('should categorize series files', () => {
      expect(categorizeFile('/path/show.s01e01.mkv')).toBe('series');
      expect(categorizeFile('/path/series.season.1.mp4')).toBe('series');
      expect(categorizeFile('/path/tv.episode.avi')).toBe('series');
    });

    it('should categorize music files', () => {
      expect(categorizeFile('/path/song.mp3')).toBe('music');
      expect(categorizeFile('/path/audio.flac')).toBe('music');
      expect(categorizeFile('/path/track.wav')).toBe('music');
    });

    it('should categorize photo files', () => {
      expect(categorizeFile('/path/image.jpg')).toBe('photo');
      expect(categorizeFile('/path/picture.png')).toBe('photo');
      expect(categorizeFile('/path/photo.heic')).toBe('photo');
    });

    it('should categorize book files', () => {
      expect(categorizeFile('/path/novel.epub')).toBe('book');
      expect(categorizeFile('/path/book.mobi')).toBe('book');
      expect(categorizeFile('/path/ebook.azw')).toBe('book');
    });

    it('should default to general for unknown types', () => {
      expect(categorizeFile('/path/unknown.xyz')).toBe('general');
      expect(categorizeFile('/path/file')).toBe('general');
    });

    it('should categorize .pdf file as document even without matching keywords', () => {
      // A plain PDF file with no keywords → hits the default 'document' return (line 177)
      expect(categorizeFile('/path/somefile.pdf')).toBe('document');
    });

    it('should categorize .png file as photo even without matching keywords', () => {
      // A plain PNG with no photo keywords → hits the default 'photo' return (lines 199-200)
      expect(categorizeFile('/path/screenshot.png')).toBe('photo');
    });

    it('should prioritize series over movie for video files with series keywords', () => {
      expect(categorizeFile('/path/breaking-bad.s01e01.mp4')).toBe('series');
      expect(categorizeFile('/path/movie.mkv', 'This is season 1 episode 1')).toBe('series');
    });

    it('should use parentFolder hint when provided in fileInfo', () => {
      // Exercises the fileInfo?.parentFolder branch (lines 113-115 of file-templates.ts)
      const fileInfo = {
        path: '/home/user/movies/film.mp4',
        name: 'film.mp4',
        extension: '.mp4',
        size: 1000,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        parentFolder: 'movies',
        folderPath: ['home', 'user']
      } as FileInfo;
      expect(categorizeFile('/home/user/movies/film.mp4', '', fileInfo)).toBe('movie');
    });

    it('should categorize PDF with book keywords as book', () => {
      // Exercises the document-extension + bookKeywords branch (lines 170-172 of file-templates.ts)
      expect(categorizeFile('/path/my-book.pdf', 'This is chapter 1 of a novel by the author')).toBe('book');
    });

    it('should use documentMetadata fields (author/creator/subject/keywords) for categorization', () => {
      // Exercises lines 102-105: true branches for author, creator, subject, keywords
      const fileInfo = {
        path: '/path/file.mp4',
        name: 'file.mp4',
        extension: '.mp4',
        size: 1000,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        documentMetadata: {
          title: 'My Show',
          author: 'Someone',
          creator: 'Studio',
          subject: 'Entertainment',
          keywords: ['season', 'episode']
        }
      } as FileInfo;
      expect(categorizeFile('/path/file.mp4', '', fileInfo)).toBe('series');
    });

    it('should categorize using documentMetadata that has no title', () => {
      // Exercises the false branch of `if (meta.title)` (line 101)
      const fileInfo = {
        path: '/path/file.mp4',
        name: 'file.mp4',
        extension: '.mp4',
        size: 1000,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        documentMetadata: {
          keywords: ['season', 'episode']
        }
      } as FileInfo;
      expect(categorizeFile('/path/file.mp4', '', fileInfo)).toBe('series');
    });

    it('should categorize by series folder hint', () => {
      // Exercises line 153: folderSeriesHints match
      const fileInfo = {
        path: '/home/user/tv/show.mkv',
        name: 'show.mkv',
        extension: '.mkv',
        size: 1000,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        folderPath: ['home', 'user', 'tv']
      } as FileInfo;
      expect(categorizeFile('/home/user/tv/show.mkv', '', fileInfo)).toBe('series');
    });

    it('should categorize by music folder hint', () => {
      // Exercises line 155: folderMusicHints match
      const fileInfo = {
        path: '/home/user/music/song.mp3',
        name: 'song.mp3',
        extension: '.mp3',
        size: 1000,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        folderPath: ['home', 'user', 'music']
      } as FileInfo;
      expect(categorizeFile('/home/user/music/song.mp3', '', fileInfo)).toBe('music');
    });

    it('should categorize by photo folder hint', () => {
      // Exercises line 156: folderPhotoHints match
      const fileInfo = {
        path: '/home/user/photos/img.jpg',
        name: 'img.jpg',
        extension: '.jpg',
        size: 1000,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        folderPath: ['home', 'user', 'photos']
      } as FileInfo;
      expect(categorizeFile('/home/user/photos/img.jpg', '', fileInfo)).toBe('photo');
    });

    it('should categorize by book folder hint', () => {
      // Exercises line 157: folderBookHints match
      const fileInfo = {
        path: '/home/user/books/novel.pdf',
        name: 'novel.pdf',
        extension: '.pdf',
        size: 1000,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        folderPath: ['home', 'user', 'books']
      } as FileInfo;
      expect(categorizeFile('/home/user/books/novel.pdf', '', fileInfo)).toBe('book');
    });

    it('should categorize by document folder hint', () => {
      // Exercises line 158: folderDocumentHints match
      const fileInfo = {
        path: '/home/user/documents/report.pdf',
        name: 'report.pdf',
        extension: '.pdf',
        size: 1000,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        folderPath: ['home', 'user', 'documents']
      } as FileInfo;
      expect(categorizeFile('/home/user/documents/report.pdf', '', fileInfo)).toBe('document');
    });
  });

  describe('applyTemplate()', () => {
    it('should apply document template with personal name and date', () => {
      const result = applyTemplate(
        'driving-license',
        'document',
        { category: 'document', personalName: 'amirhossein', dateFormat: 'YYYYMMDD' },
        'kebab-case',
        undefined,
        '2023-06-15'
      );

      // Should match pattern: {content}-{personalName}-{date}
      expect(result).toBe('driving-license-amirhossein-20230615');
    });

    it('should apply movie template (AI provides the full name including year)', () => {
      // The movie template pattern is {content}; the AI is responsible for
      // including the year in the generated name (e.g. "the-dark-knight-2008").
      const result = applyTemplate(
        'the-dark-knight-2008',
        'movie',
        { category: 'movie', dateFormat: 'none' },
        'kebab-case'
      );
      expect(result).toBe('the-dark-knight-2008');
    });

    it('should use document metadata creationDate for {date} when fileInfo is provided', () => {
      const fileInfo: FileInfo = {
        path: '/docs/contract.pdf',
        name: 'contract.pdf',
        extension: '.pdf',
        size: 1024,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        parentFolder: 'docs',
        folderPath: ['docs'],
        documentMetadata: {
          creationDate: new Date('2023-06-15')
        }
      };

      const result = applyTemplate(
        'employment-contract',
        'document',
        { category: 'document', personalName: 'alice', dateFormat: 'YYYYMMDD' },
        'kebab-case',
        fileInfo
      );

      expect(result).toBe('employment-contract-alice-20230615');
    });

    it('should apply different date formats', () => {
      const baseOptions = { category: 'document' as FileCategory, personalName: 'john' };

      const yyyymmdd = applyTemplate('contract', 'document', { ...baseOptions, dateFormat: 'YYYYMMDD' }, 'kebab-case', undefined, '2023-06-15');
      const yyyymmdd2 = applyTemplate('contract', 'document', { ...baseOptions, dateFormat: 'YYYY-MM-DD' }, 'kebab-case', undefined, '2023-06-15');
      const yyyy = applyTemplate('contract', 'document', { ...baseOptions, dateFormat: 'YYYY' }, 'kebab-case', undefined, '2023-06-15');

      expect(yyyymmdd).toBe('contract-john-20230615');
      expect(yyyymmdd2).toBe('contract-john-2023-06-15');
      expect(yyyy).toBe('contract-john-2023');
    });

    it('should handle no date format', () => {
      const result = applyTemplate(
        'document',
        'document',
        { category: 'document', personalName: 'jane', dateFormat: 'none' },
        'kebab-case'
      );
      
      expect(result).toBe('document-jane');
    });

    it('should handle missing personal name', () => {
      const result = applyTemplate(
        'report',
        'document',
        { category: 'document', dateFormat: 'YYYY' },
        'kebab-case',
        undefined,
        '2023-06-15'
      );

      expect(result).toBe('report-2023');
    });

    it('should apply naming conventions correctly', () => {
      const baseOptions = { category: 'document' as FileCategory, personalName: 'test-user', dateFormat: 'none' as const };
      
      const kebab = applyTemplate('My Document', 'document', baseOptions, 'kebab-case');
      const snake = applyTemplate('My Document', 'document', baseOptions, 'snake_case');
      const camel = applyTemplate('My Document', 'document', baseOptions, 'camelCase');
      
      expect(kebab).toBe('my-document-test-user');
      expect(snake).toBe('my_document_test_user');
      expect(camel).toBe('myDocumentTestUser');
    });

    it('should clean up multiple separators', () => {
      const result = applyTemplate(
        'test--document',
        'document',
        { category: 'document', personalName: 'user', dateFormat: 'none' },
        'kebab-case'
      );
      
      expect(result).toBe('test-document-user');
    });

    it('should handle general category', () => {
      const result = applyTemplate(
        'meeting-notes',
        'general',
        { category: 'general', personalName: 'admin', dateFormat: 'YYYY' },
        'kebab-case'
      );

      expect(result).toBe('meeting-notes');
    });

    it('should throw error when category is auto', () => {
      expect(() => applyTemplate('test', 'auto', {}, 'kebab-case')).toThrow(
        'Cannot apply template for "auto" category'
      );
    });

    it('should handle unknown dateFormat via default case', () => {
      // Pass an unknown dateFormat by casting to bypass TypeScript type checking
      // This exercises the 'default' branch in the formatDate switch statement
      const result = applyTemplate(
        'contract',
        'document',
        { category: 'document', personalName: 'john', dateFormat: 'UNKNOWN' as any },
        'kebab-case',
        undefined,
        '2023-06-15'
      );
      // The default case returns YYYYMMDD format: year + month + day
      expect(result).toBe('contract-john-20230615');
    });
  });

  describe('applyTemplate() — personal name stripping', () => {
    it('strips the personal name from the start of the AI content for document category', () => {
      const result = applyTemplate(
        'amirhossein-daraei-birth-certificate',
        'document',
        { personalName: 'amirhossein-daraei', dateFormat: 'none' },
        'kebab-case'
      );
      expect(result).toBe('birth-certificate-amirhossein-daraei');
    });

    it('strips the personal name from the middle of space-separated content', () => {
      const result = applyTemplate(
        'certificate amirhossein daraei of residence',
        'document',
        { personalName: 'amirhossein-daraei', dateFormat: 'none' },
        'kebab-case'
      );
      expect(result).toBe('certificate-of-residence-amirhossein-daraei');
    });

    it('matches the personal name case-insensitively and separator-insensitively', () => {
      const result = applyTemplate(
        'Amirhossein-Daraei-contract',
        'document',
        { personalName: 'amirhossein daraei', dateFormat: 'none' },
        'kebab-case'
      );
      expect(result).toBe('contract-amirhossein-daraei');
    });

    it('keeps the content when it is exactly the personal name (no empty {content})', () => {
      const result = applyTemplate(
        'amirhossein-daraei',
        'document',
        { personalName: 'amirhossein-daraei', dateFormat: 'none' },
        'kebab-case'
      );
      expect(result).toBe('amirhossein-daraei-amirhossein-daraei');
    });

    it('does not strip the name for categories whose pattern has no {personalName}', () => {
      const result = applyTemplate(
        'amirhossein-daraei-notes',
        'general',
        { personalName: 'amirhossein-daraei' },
        'kebab-case'
      );
      expect(result).toBe('amirhossein-daraei-notes');
    });

    it('strips every occurrence of the personal name', () => {
      const result = applyTemplate(
        'amirhossein-daraei-passport-amirhossein-daraei-scan',
        'document',
        { personalName: 'amirhossein-daraei', dateFormat: 'none' },
        'kebab-case'
      );
      expect(result).toBe('passport-scan-amirhossein-daraei');
    });

    it('leaves content untouched when the personal name has no alphanumeric tokens', () => {
      // stripNameFromContent bails out when the name yields zero tokens
      const result = applyTemplate(
        'notes',
        'document',
        { personalName: '---', dateFormat: 'none' },
        'kebab-case'
      );
      expect(result).toBe('notes');
    });
  });

  describe('getTemplateInstructions()', () => {
    it('should return instructions for each category', () => {
      const categories: FileCategory[] = ['document', 'movie', 'music', 'series', 'photo', 'book', 'general'];

      categories.forEach(category => {
        const instructions = getTemplateInstructions(category);
        expect(instructions).toContain(category);
        expect(instructions.length).toBeGreaterThan(10);
      });
    });

    it('should include examples in instructions', () => {
      const documentInstructions = getTemplateInstructions('document');
      expect(documentInstructions).toContain('driving-license-amirhossein');

      const movieInstructions = getTemplateInstructions('movie');
      expect(movieInstructions).toContain('the-dark-knight-2008');
    });

    it('should return early auto message for auto category', () => {
      const result = getTemplateInstructions('auto');
      expect(result).toBe('Generate appropriate filename based on detected file type and content.');
    });

    it('should tell AI to include release year in movie filenames', () => {
      const instructions = getTemplateInstructions('movie');
      expect(instructions).toContain('release year');
    });

    it('should tell AI to include artist name for music filenames', () => {
      const instructions = getTemplateInstructions('music');
      expect(instructions).toContain('artist name');
      expect(instructions).toContain('track title');
    });

    it('should tell AI to include season and episode numbers for series filenames', () => {
      const instructions = getTemplateInstructions('series');
      expect(instructions).toContain('season');
      expect(instructions).toContain('episode');
      expect(instructions).toContain('s01e01');
    });

    it('should tell AI to include author name for book filenames', () => {
      const instructions = getTemplateInstructions('book');
      expect(instructions).toContain('author name');
      expect(instructions).toContain('book title');
    });

    it('should not include media-specific instructions for document category', () => {
      const instructions = getTemplateInstructions('document');
      expect(instructions).not.toContain('release year');
      expect(instructions).not.toContain('artist name');
      expect(instructions).not.toContain('s01e01');
    });

    it('should not include media-specific instructions for general category', () => {
      const instructions = getTemplateInstructions('general');
      expect(instructions).not.toContain('release year');
      expect(instructions).not.toContain('artist name');
      expect(instructions).not.toContain('s01e01');
    });
  });

  describe('FILE_TEMPLATES patterns', () => {
    it('should use {content} only for movie (AI provides full name including year)', () => {
      expect(FILE_TEMPLATES.movie.pattern).toBe('{content}');
    });

    it('should use {content} only for music (AI provides full name including artist)', () => {
      expect(FILE_TEMPLATES.music.pattern).toBe('{content}');
    });

    it('should use {content} only for series (AI provides full name including season/episode)', () => {
      expect(FILE_TEMPLATES.series.pattern).toBe('{content}');
    });

    it('should use {content} only for book (AI provides full name including author)', () => {
      expect(FILE_TEMPLATES.book.pattern).toBe('{content}');
    });

    it('should apply music template — AI-generated full name passes through unchanged', () => {
      const result = applyTemplate(
        'the-beatles-hey-jude',
        'music',
        { category: 'music', dateFormat: 'none' },
        'kebab-case'
      );
      expect(result).toBe('the-beatles-hey-jude');
    });

    it('should apply series template — AI-generated full name passes through unchanged', () => {
      const result = applyTemplate(
        'breaking-bad-s01e01',
        'series',
        { category: 'series', dateFormat: 'none' },
        'kebab-case'
      );
      expect(result).toBe('breaking-bad-s01e01');
    });

    it('should apply book template — AI-generated full name passes through unchanged', () => {
      const result = applyTemplate(
        'george-orwell-1984',
        'book',
        { category: 'book', dateFormat: 'none' },
        'kebab-case'
      );
      expect(result).toBe('george-orwell-1984');
    });
  });

  describe('applyTemplate() — date fallback behaviour', () => {
    it('should omit the date segment when fileInfo is not provided', () => {
      const result = applyTemplate(
        'report',
        'document',
        { category: 'document', personalName: 'admin', dateFormat: 'YYYY' },
        'kebab-case'
        // no fileInfo, no documentDate — no source for a real date
      );
      expect(result).toBe('report-admin');
    });

    it('should omit the date segment when documentMetadata is absent', () => {
      const fileInfoNoMeta: FileInfo = {
        path: '/docs/file.pdf',
        name: 'file.pdf',
        extension: '.pdf',
        size: 1024,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        parentFolder: 'docs',
        folderPath: ['docs']
        // no documentMetadata
      };
      const result = applyTemplate(
        'memo',
        'document',
        { category: 'document', personalName: 'user', dateFormat: 'YYYY' },
        'kebab-case',
        fileInfoNoMeta
      );
      expect(result).toBe('memo-user');
    });

    it('should omit the date segment when creationDate is missing from metadata', () => {
      const fileInfoPartialMeta: FileInfo = {
        path: '/docs/file.pdf',
        name: 'file.pdf',
        extension: '.pdf',
        size: 1024,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        parentFolder: 'docs',
        folderPath: ['docs'],
        documentMetadata: { title: 'Some title' } // no creationDate
      };
      const result = applyTemplate(
        'contract',
        'document',
        { category: 'document', personalName: 'jane', dateFormat: 'YYYY' },
        'kebab-case',
        fileInfoPartialMeta
      );
      expect(result).toBe('contract-jane');
    });
  });

  describe('FILE_TEMPLATES', () => {
    it('should have all required template categories', () => {
      const expectedCategories: FileCategory[] = ['document', 'movie', 'music', 'series', 'photo', 'book', 'general'];
      
      expectedCategories.forEach(category => {
        expect(FILE_TEMPLATES[category]).toBeDefined();
        expect(FILE_TEMPLATES[category].category).toBe(category);
        expect(FILE_TEMPLATES[category].pattern).toBeDefined();
        expect(FILE_TEMPLATES[category].description).toBeDefined();
        expect(FILE_TEMPLATES[category].examples.length).toBeGreaterThan(0);
      });
    });

    it('should have valid patterns', () => {
      Object.values(FILE_TEMPLATES).forEach(template => {
        expect(template.pattern).toContain('{content}');
        expect(template.examples.length).toBeGreaterThan(2);
      });
    });
  });

  describe('date resolution', () => {
    const opts = { personalName: 'john', dateFormat: 'YYYYMMDD' as const };
    const withMetaDate = (d: Date) => ({
      path: '/x/a.pdf', name: 'a.pdf', extension: '.pdf', size: 1,
      documentMetadata: { creationDate: d }
    }) as any;

    it('prefers the date the model read off the document', () => {
      const result = applyTemplate('invoice', 'document', opts, 'kebab-case',
        withMetaDate(new Date(2023, 10, 8)), '2019-04-02');
      expect(result).toBe('invoice-john-20190402');
    });

    it('falls back to file metadata when the model reported no date', () => {
      const result = applyTemplate('report', 'document', opts, 'kebab-case',
        withMetaDate(new Date(2023, 10, 8)), undefined);
      expect(result).toBe('report-john-20231108');
    });

    it('falls back to file metadata when the reported date is invalid', () => {
      const result = applyTemplate('report', 'document', opts, 'kebab-case',
        withMetaDate(new Date(2023, 10, 8)), '2087-04-02');
      expect(result).toBe('report-john-20231108');
    });

    // the bug: a scanned file with no usable date used to be stamped with today
    it('omits the segment entirely when no date is available', () => {
      const result = applyTemplate('dental-invoice', 'document', opts, 'kebab-case',
        { path: '/x/a.pdf', name: 'a.pdf', extension: '.pdf', size: 1 } as any, undefined);
      expect(result).toBe('dental-invoice-john');
      expect(result).not.toMatch(/\d{8}/);
    });

    it('leaves no trailing separator when the date is omitted', () => {
      const result = applyTemplate('dental-invoice', 'document',
        { dateFormat: 'YYYYMMDD' as const }, 'kebab-case',
        { path: '/x/a.pdf', name: 'a.pdf', extension: '.pdf', size: 1 } as any, undefined);
      expect(result).toBe('dental-invoice');
      expect(result.endsWith('-')).toBe(false);
    });

    it('renders no date at all when dateFormat is none', () => {
      const result = applyTemplate('invoice', 'document',
        { personalName: 'john', dateFormat: 'none' as const }, 'kebab-case',
        withMetaDate(new Date(2023, 10, 8)), '2019-04-02');
      expect(result).toBe('invoice-john');
    });

    // Covers the offset===0 branch of the token-cleanup regex: with an empty
    // {content} substitution, the next unfilled token becomes effectively
    // leading. No current FILE_TEMPLATES pattern starts with a token itself,
    // but an empty aiGeneratedName reaches the same code path.
    it('handles an unfilled token that becomes leading once {content} is empty', () => {
      const result = applyTemplate('', 'document', { dateFormat: 'none' }, 'kebab-case');
      expect(result).toBe('personalname');
    });
  });
});