import { describe, it, expect } from 'vitest';
import { buildFileNamePrompt, AI_SYSTEM_PROMPT } from '../../../src/utils/ai-prompts.js';
import { FileInfo } from '../../../src/types/index.js';

describe('AI Prompts', () => {
  describe('buildFileNamePrompt', () => {
    it('should build basic prompt with minimal context', () => {
      const prompt = buildFileNamePrompt({
        content: 'This is a sample document about contract negotiations.',
        originalName: 'document.pdf',
        namingConvention: 'kebab-case',
        category: 'general'
      });

      expect(prompt).toContain('Based on the following document information');
      expect(prompt).toContain('Descriptive and meaningful');
      expect(prompt).toContain('Between 3-10 words');
      expect(prompt).toContain('hyphens between words');
      expect(prompt).toContain('This is a sample document about contract negotiations');
      expect(prompt).toContain('Respond with only the filename');
    });

    it('should include file metadata when provided', () => {
      const mockFileInfo: FileInfo = {
        name: 'contract.pdf',
        path: '/documents/contract.pdf',
        extension: '.pdf',
        size: 1024 * 50, // 50KB
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'contracts',
        folderPath: ['home', 'documents', 'contracts']
      };

      const prompt = buildFileNamePrompt({
        content: 'Employment contract for John Doe.',
        originalName: 'contract.pdf',
        namingConvention: 'kebab-case',
        category: 'document',
        fileInfo: mockFileInfo
      });

      expect(prompt).toContain('File Information:');
      expect(prompt).toContain('- Original filename: contract.pdf');
      expect(prompt).toContain('- File size: 50KB');
      expect(prompt).toContain('- Parent folder: contracts');
      expect(prompt).toContain('- Folder path: home > documents > contracts');
    });

    it('should include document metadata when available', () => {
      const mockFileInfo: FileInfo = {
        name: 'report.pdf',
        path: '/reports/report.pdf',
        extension: '.pdf',
        size: 1024 * 100,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'reports',
        folderPath: ['home', 'reports'],
        documentMetadata: {
          title: 'Annual Financial Report',
          author: 'Jane Smith',
          creator: 'Microsoft Word',
          subject: 'Company Finances',
          keywords: ['finance', 'annual', 'report'],
          creationDate: new Date('2024-01-10'),
          modificationDate: new Date('2024-01-20'),
          pages: 25,
          wordCount: 5000
        }
      };

      const prompt = buildFileNamePrompt({
        content: 'This report covers the annual financial performance...',
        originalName: 'report.pdf',
        namingConvention: 'snake_case',
        category: 'document',
        fileInfo: mockFileInfo
      });

      expect(prompt).toContain('Document Properties:');
      expect(prompt).toContain('- Title: Annual Financial Report');
      expect(prompt).toContain('- Author: Jane Smith');
      expect(prompt).toContain('- Creator: Microsoft Word');
      expect(prompt).toContain('- Subject: Company Finances');
      expect(prompt).toContain('- Keywords: finance, annual, report');
      expect(prompt).toContain('- Pages: 25');
      expect(prompt).toContain('- Word count: 5000');
    });

    it('should include person name detection instructions', () => {
      const prompt = buildFileNamePrompt({
        content: 'Visa application for Setareh Ahmadi to visit Canada.',
        originalName: 'visa-app.pdf',
        namingConvention: 'kebab-case',
        category: 'document'
      });

      expect(prompt).toContain('If the document is specifically for/about a person (based on content), include their name at the beginning');
      expect(prompt).toContain('Important: If this document is specifically for or about a particular person mentioned in the content, start the filename with their name');
    });

    it('should include folder name filtering instructions', () => {
      const prompt = buildFileNamePrompt({
        content: 'Meeting notes from Q4 planning session.',
        originalName: 'notes.txt',
        namingConvention: 'camelCase',
        category: 'general'
      });

      expect(prompt).toContain('Ignore irrelevant folder names that don\'t describe the document content');
      expect(prompt).toContain('Focus on the document\'s actual content and purpose, not just metadata');
    });

    it('should handle different naming conventions', () => {
      const kebabPrompt = buildFileNamePrompt({
        content: 'Test content',
        originalName: 'test.txt',
        namingConvention: 'kebab-case',
        category: 'general'
      });

      const snakePrompt = buildFileNamePrompt({
        content: 'Test content',
        originalName: 'test.txt',
        namingConvention: 'snake_case',
        category: 'general'
      });

      expect(kebabPrompt).toContain('hyphens between words');
      expect(snakePrompt).toContain('underscores between words');
    });

    it('should handle different file categories', () => {
      const documentPrompt = buildFileNamePrompt({
        content: 'Contract content',
        originalName: 'contract.pdf',
        namingConvention: 'kebab-case',
        category: 'document'
      });

      const moviePrompt = buildFileNamePrompt({
        content: 'Movie file content',
        originalName: 'movie.mp4',
        namingConvention: 'kebab-case',
        category: 'movie'
      });

      expect(documentPrompt).toContain('document');
      expect(moviePrompt).toContain('movie');
    });

    it('should truncate content to 2000 characters', () => {
      const longContent = 'a'.repeat(3000);
      
      const prompt = buildFileNamePrompt({
        content: longContent,
        originalName: 'long.txt',
        namingConvention: 'kebab-case',
        category: 'general'
      });

      const contentSection = prompt.substring(prompt.indexOf('Document content'));
      expect(contentSection).toContain('a'.repeat(2000));
      expect(contentSection).not.toContain('a'.repeat(2001));
    });

    it('should handle missing optional metadata gracefully', () => {
      const mockFileInfo: FileInfo = {
        name: 'simple.txt',
        path: '/simple.txt',
        extension: '.txt',
        size: 1024,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'root',
        folderPath: ['root'],
        documentMetadata: {
          // Only some fields provided
          title: 'Simple Document'
          // author, creator, etc. are undefined
        }
      };

      const prompt = buildFileNamePrompt({
        content: 'Simple document content.',
        originalName: 'simple.txt',
        namingConvention: 'kebab-case',
        category: 'general',
        fileInfo: mockFileInfo
      });

      expect(prompt).toContain('- Title: Simple Document');
      expect(prompt).not.toContain('- Author:');
      expect(prompt).not.toContain('- Creator:');
    });
  });

  describe('AI_SYSTEM_PROMPT', () => {
    it('should provide clear system instructions', () => {
      expect(AI_SYSTEM_PROMPT).toContain('helpful assistant');
      expect(AI_SYSTEM_PROMPT).toContain('generates descriptive filenames');
      expect(AI_SYSTEM_PROMPT).toContain('just the filename');
      expect(AI_SYSTEM_PROMPT).toContain('no explanation');
    });

    it('should be a non-empty string', () => {
      expect(AI_SYSTEM_PROMPT).toBeTruthy();
      expect(typeof AI_SYSTEM_PROMPT).toBe('string');
      expect(AI_SYSTEM_PROMPT.length).toBeGreaterThan(20);
    });
  });
});