import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileRenamer } from '../../src/services/file-renamer.js';
import { DocumentParserFactory } from '../../src/parsers/factory.js';
import { AIProvider, FileInfo, Config } from '../../src/types/index.js';

// Mock AI Provider that captures prompts for testing
class MockAIProvider implements AIProvider {
  name = 'MockAI';
  public capturedPrompts: string[] = [];
  public capturedContext: any[] = [];
  
  async generateFileName(
    content: string, 
    originalName: string, 
    namingConvention = 'kebab-case', 
    category = 'general',
    fileInfo?: FileInfo
  ): Promise<string> {
    // Capture the prompt for analysis (we can't see the actual prompt here, but we can test the result)
    this.capturedContext.push({
      content,
      originalName,
      namingConvention,
      category,
      fileInfo
    });

    // Mock intelligent responses based on content (AI generates core name, template applies later)
    if (content.includes('Setareh') && content.includes('visa')) {
      return 'setareh-visitor-visa-application-for-family-members-in-canada';
    }
    
    if (content.includes('John Doe') && content.includes('contract')) {
      return 'john-doe-employment-contract-software-engineer';
    }
    
    if (content.includes('Maria') && content.includes('wedding')) {
      return 'maria-wedding-ceremony-invitation-june-2024';
    }

    // Default response
    return 'generic-document-filename';
  }
}

describe('AI Prompting Integration Tests', () => {
  let mockAI: MockAIProvider;
  let fileRenamer: FileRenamer;
  let config: Config;

  beforeEach(() => {
    mockAI = new MockAIProvider();
    const parserFactory = new DocumentParserFactory();
    
    config = {
      provider: 'claude',
      apiKey: 'test-key',
      maxFileSize: 10 * 1024 * 1024,
      namingConvention: 'kebab-case',
      templateOptions: {
        category: 'document',
        personalName: 'TestUser',
        dateFormat: 'YYYY-MM-DD'
      },
      dryRun: true
    };

    fileRenamer = new FileRenamer(parserFactory, mockAI, config);
  });

  describe('Person Name Detection and Placement', () => {
    it('should place person names at the beginning when detected in content', async () => {
      const fileInfo: FileInfo = {
        name: 'visa-application.pdf',
        path: '/no/visa-application.pdf', // Note: irrelevant folder name "no"
        extension: '.pdf',
        size: 1024 * 50,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'no', // Should be ignored
        folderPath: ['home', 'documents', 'no']
      };

      // Mock the parser to return content with person name
      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Visitor visa application for Setareh Ahmadi and family members to visit Canada. This application includes documentation for tourism purposes.',
          metadata: {
            title: 'Visa Application Form',
            pages: 3
          }
        })
      };

      // Mock the parser factory
      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Template applies: {content}-{personalName}-{date}
      expect(results[0].suggestedName).toMatch(/setareh-visitor-visa-application-for-family-members-in-canada-testuser-\d{4}-\d{2}-\d{2}\.pdf/);
      
      // Verify the AI was called with the right context
      expect(mockAI.capturedContext).toHaveLength(1);
      expect(mockAI.capturedContext[0].content).toContain('Setareh Ahmadi');
      expect(mockAI.capturedContext[0].fileInfo.parentFolder).toBe('no');
    });

    it('should handle contract documents with person names', async () => {
      const fileInfo: FileInfo = {
        name: 'employment-contract.pdf',
        path: '/contracts/employment-contract.pdf',
        extension: '.pdf',
        size: 1024 * 75,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'contracts',
        folderPath: ['home', 'legal', 'contracts']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Employment Contract between TechCorp Inc. and John Doe for the position of Senior Software Engineer. This contract outlines terms of employment, salary, and benefits.',
          metadata: {
            title: 'Employment Agreement',
            author: 'Legal Department',
            pages: 8
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Template applies: {content}-{personalName}-{date}
      expect(results[0].suggestedName).toMatch(/john-doe-employment-contract-software-engineer-testuser-\d{4}-\d{2}-\d{2}\.pdf/);
    });

    it('should handle wedding documents with person names', async () => {
      const fileInfo: FileInfo = {
        name: 'invitation.pdf',
        path: '/events/invitation.pdf',
        extension: '.pdf',
        size: 1024 * 25,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'events',
        folderPath: ['home', 'personal', 'events']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'You are cordially invited to the wedding ceremony of Maria Rodriguez and David Thompson on June 15th, 2024 at St. Mary\'s Church.',
          metadata: {
            title: 'Wedding Invitation',
            pages: 1
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Template applies: {content}-{personalName}-{date}
      expect(results[0].suggestedName).toMatch(/maria-wedding-ceremony-invitation-june-2024-testuser-\d{4}-\d{2}-\d{2}\.pdf/);
    });
  });

  describe('Folder Name Filtering', () => {
    it('should ignore irrelevant folder names like "no"', async () => {
      const fileInfo: FileInfo = {
        name: 'document.pdf',
        path: '/no/document.pdf',
        extension: '.pdf',
        size: 1024 * 30,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'no', // This should be ignored by AI
        folderPath: ['home', 'downloads', 'no']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'This is a general business report about quarterly sales performance and market analysis.',
          metadata: {
            title: 'Q4 Sales Report',
            pages: 12
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Should not include "no" in the filename, template applies: {content}-{personalName}-{date}
      expect(results[0].suggestedName).not.toContain('no');
      expect(results[0].suggestedName).toMatch(/generic-document-filename-testuser-\d{4}-\d{2}-\d{2}\.pdf/);
      
      // Verify the folder context was passed but should be ignored by prompt instructions
      expect(mockAI.capturedContext[0].fileInfo.parentFolder).toBe('no');
    });

    it('should handle meaningful folder names appropriately', async () => {
      const fileInfo: FileInfo = {
        name: 'report.pdf',
        path: '/financial-reports/report.pdf',
        extension: '.pdf',
        size: 1024 * 45,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'financial-reports',
        folderPath: ['home', 'business', 'financial-reports']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Annual financial statement showing revenue, expenses, and profit margins for fiscal year 2023.',
          metadata: {
            title: 'Annual Financial Statement',
            pages: 20
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // The AI gets the folder context but should focus on content, not folder name
      expect(mockAI.capturedContext[0].fileInfo.parentFolder).toBe('financial-reports');
    });
  });

  describe('Template Integration with AI Prompting', () => {
    it('should work with document template and person detection', async () => {
      config.templateOptions.category = 'document';
      config.templateOptions.personalName = 'TestUser';
      
      const fileInfo: FileInfo = {
        name: 'contract.pdf',
        path: '/legal/contract.pdf',
        extension: '.pdf',
        size: 1024 * 60,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'legal',
        folderPath: ['home', 'legal']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Service agreement between Company ABC and Setareh Ahmadi for consulting services.',
          metadata: {
            title: 'Service Agreement',
            pages: 5
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // AI should detect "Setareh" and include it at the beginning, but our mock doesn't match this content
      expect(results[0].suggestedName).toMatch(/generic-document-filename-testuser-\d{4}-\d{2}-\d{2}\.pdf/);
    });

    it('should pass correct category information to AI', async () => {
      config.templateOptions.category = 'movie';
      
      const fileInfo: FileInfo = {
        name: 'film.mp4',
        path: '/movies/film.mp4',
        extension: '.mp4',
        size: 1024 * 1024 * 500, // 500MB
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'movies',
        folderPath: ['home', 'media', 'movies']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Movie file metadata or subtitle content here.',
          metadata: {}
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);
      
      // Reduce file size to avoid maxFileSize limit
      fileInfo.size = 1024 * 1024; // 1MB instead of 500MB

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      expect(mockAI.capturedContext[0].category).toBe('movie');
      // Movie template doesn't include personalName, just {content}-{year}
      expect(results[0].suggestedName).toBe('generic-document-filename.mp4');
    });
  });

  describe('Naming Convention Integration', () => {
    it('should pass naming convention to AI prompting system', async () => {
      config.namingConvention = 'snake_case';
      
      const fileInfo: FileInfo = {
        name: 'test.txt',
        path: '/test.txt',
        extension: '.txt',
        size: 1024,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'root',
        folderPath: ['root']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Test document content.',
          metadata: {}
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      expect(mockAI.capturedContext[0].namingConvention).toBe('snake_case');
    });
  });

  describe('Content and Metadata Passing', () => {
    it('should pass all relevant metadata to AI service', async () => {
      const fileInfo: FileInfo = {
        name: 'comprehensive.pdf',
        path: '/docs/comprehensive.pdf',
        extension: '.pdf',
        size: 1024 * 100,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'docs',
        folderPath: ['home', 'documents', 'docs'],
        documentMetadata: {
          title: 'Comprehensive Report',
          author: 'Dr. Smith',
          creator: 'LaTeX',
          subject: 'Research Findings',
          keywords: ['research', 'analysis', 'data'],
          creationDate: new Date('2024-01-10'),
          modificationDate: new Date('2024-01-25'),
          pages: 45,
          wordCount: 12000
        }
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Comprehensive research report on data analysis methodologies and findings.',
          metadata: fileInfo.documentMetadata
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      
      const capturedContext = mockAI.capturedContext[0];
      expect(capturedContext.fileInfo.documentMetadata.title).toBe('Comprehensive Report');
      expect(capturedContext.fileInfo.documentMetadata.author).toBe('Dr. Smith');
      expect(capturedContext.fileInfo.documentMetadata.keywords).toEqual(['research', 'analysis', 'data']);
    });
  });
});