import { describe, it, expect } from 'vitest';
import { 
  categorizeFile, 
  applyTemplate, 
  getTemplateInstructions, 
  FILE_TEMPLATES,
  FileCategory 
} from '../../../src/utils/file-templates.js';

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

    it('should prioritize series over movie for video files with series keywords', () => {
      expect(categorizeFile('/path/breaking-bad.s01e01.mp4')).toBe('series');
      expect(categorizeFile('/path/movie.mkv', 'This is season 1 episode 1')).toBe('series');
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