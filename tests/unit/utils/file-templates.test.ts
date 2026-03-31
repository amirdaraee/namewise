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
        'kebab-case'
      );
      
      // Should match pattern: {content}-{personalName}-{date}
      expect(result).toMatch(/^driving-license-amirhossein-\d{8}$/);
    });

    it('should apply movie template with year', () => {
      const result = applyTemplate(
        'the-dark-knight',
        'movie',
        { category: 'movie', dateFormat: 'YYYY' },
        'kebab-case'
      );
      
      // Movies don't use personal names in their template pattern
      expect(result).toBe('the-dark-knight');
    });

    it('should apply different date formats', () => {
      const baseOptions = { category: 'document' as FileCategory, personalName: 'john' };
      
      const yyyymmdd = applyTemplate('contract', 'document', { ...baseOptions, dateFormat: 'YYYYMMDD' }, 'kebab-case');
      const yyyymmdd2 = applyTemplate('contract', 'document', { ...baseOptions, dateFormat: 'YYYY-MM-DD' }, 'kebab-case');
      const yyyy = applyTemplate('contract', 'document', { ...baseOptions, dateFormat: 'YYYY' }, 'kebab-case');
      
      expect(yyyymmdd).toMatch(/^contract-john-\d{8}$/);
      expect(yyyymmdd2).toMatch(/^contract-john-\d{4}-\d{2}-\d{2}$/);
      expect(yyyy).toMatch(/^contract-john-\d{4}$/);
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
        'kebab-case'
      );
      
      expect(result).toMatch(/^report-\d{4}$/);
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
        'kebab-case'
      );
      // The default case returns YYYYMMDD format: year + month + day
      expect(result).toMatch(/^contract-john-\d{8}$/);
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
});