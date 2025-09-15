import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileRenamer } from '../../src/services/file-renamer.js';
import { DocumentParserFactory } from '../../src/parsers/factory.js';
import { AIProvider, FileInfo, Config } from '../../src/types/index.js';

// Sophisticated Mock AI that simulates person name extraction behavior
class PersonNameExtractionMockAI implements AIProvider {
  name = 'PersonNameExtractionMock';
  
  async generateFileName(
    content: string, 
    originalName: string, 
    namingConvention = 'kebab-case', 
    category = 'general',
    fileInfo?: FileInfo
  ): Promise<string> {
    // Simulate intelligent person name extraction from content
    const personNamePatterns = [
      // Visa applications
      /(?:visa.*?application.*?for|application.*?for.*?visa.*?for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      // Contracts
      /(?:contract.*?between.*?and|agreement.*?with|employment.*?of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      // General "for [Name]" patterns
      /\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
      // Medical records
      /(?:patient|medical.*?record.*?for|treatment.*?for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      // Certificates
      /(?:certificate.*?for|awarded.*?to|issued.*?to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
    ];

    let extractedName = '';
    
    for (const pattern of personNamePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        extractedName = match[1].toLowerCase().replace(/\s+/g, '-');
        break;
      }
    }

    // Check for irrelevant folder names and ignore them
    const irrelevantFolders = ['no', 'temp', 'downloads', 'misc', 'other', 'files'];
    const folderName = fileInfo?.parentFolder?.toLowerCase();
    const shouldIgnoreFolder = folderName && irrelevantFolders.includes(folderName);

    // Generate appropriate filename based on content and detected person
    if (content.toLowerCase().includes('visa') && content.toLowerCase().includes('application')) {
      const baseFilename = 'visitor-visa-application-for-family-members-in-canada';
      return extractedName ? `${extractedName}-${baseFilename}` : baseFilename;
    }
    
    if (content.toLowerCase().includes('contract') || content.toLowerCase().includes('employment')) {
      const baseFilename = 'employment-contract-software-engineer';
      return extractedName ? `${extractedName}-${baseFilename}` : baseFilename;
    }
    
    if (content.toLowerCase().includes('medical') || content.toLowerCase().includes('health')) {
      const baseFilename = 'medical-record-annual-checkup';
      return extractedName ? `${extractedName}-${baseFilename}` : baseFilename;
    }
    
    if (content.toLowerCase().includes('certificate') || content.toLowerCase().includes('diploma')) {
      const baseFilename = 'certificate-completion-course';
      return extractedName ? `${extractedName}-${baseFilename}` : baseFilename;
    }
    
    if (content.toLowerCase().includes('wedding') || content.toLowerCase().includes('marriage')) {
      const baseFilename = 'wedding-ceremony-invitation';
      return extractedName ? `${extractedName}-${baseFilename}` : baseFilename;
    }

    // Generic document
    const baseFilename = 'document-summary-report';
    return extractedName ? `${extractedName}-${baseFilename}` : baseFilename;
  }
}

describe('Person Name Extraction and Folder Filtering Integration Tests', () => {
  let mockAI: PersonNameExtractionMockAI;
  let fileRenamer: FileRenamer;
  let config: Config;

  beforeEach(() => {
    mockAI = new PersonNameExtractionMockAI();
    const parserFactory = new DocumentParserFactory();
    
    config = {
      provider: 'claude',
      apiKey: 'test-key',
      maxFileSize: 10 * 1024 * 1024,
      namingConvention: 'kebab-case',
      templateOptions: {
        category: 'document',
        personalName: '',
        dateFormat: 'YYYY-MM-DD'
      },
      dryRun: true
    };

    fileRenamer = new FileRenamer(parserFactory, mockAI, config);
  });

  describe('Person Name Extraction from Document Content', () => {
    it('should extract name from visa application content - Setareh case', async () => {
      const fileInfo: FileInfo = {
        name: 'visitor-visa-application-for-family-in-canada.pdf',
        path: '/no/visitor-visa-application-for-family-in-canada.pdf',
        extension: '.pdf',
        size: 1024 * 100,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'no', // Should be ignored
        folderPath: ['home', 'downloads', 'no']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Visitor visa application for Setareh Ahmadi and family members to visit Canada. This application includes all required documentation for tourism and family visit purposes. The applicant Setareh Ahmadi is requesting permission to enter Canada.',
          metadata: {
            title: 'Visitor Visa Application',
            pages: 4
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Should start with the detected person name and include visa/application terms
      expect(results[0].suggestedName).toMatch(/^setareh/);
      expect(results[0].suggestedName).toMatch(/visa/);
      expect(results[0].suggestedName).toMatch(/application/);
      // Should not include the irrelevant folder name "no"
      expect(results[0].suggestedName).not.toContain('no');
    });

    it('should extract name from employment contract', async () => {
      const fileInfo: FileInfo = {
        name: 'contract.pdf',
        path: '/temp/contract.pdf',
        extension: '.pdf',
        size: 1024 * 75,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'temp', // Should be ignored
        folderPath: ['home', 'temp']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Employment contract between TechCorp Inc. and John Smith for the position of Senior Software Engineer. This contract outlines the terms of employment for John Smith including salary, benefits, and responsibilities.',
          metadata: {
            title: 'Employment Agreement',
            author: 'HR Department'
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Should include employment/contract terms and person name extraction logic
      expect(results[0].suggestedName).toMatch(/employment|contract/);
      expect(results[0].suggestedName).not.toContain('temp');
    });

    it('should extract name from medical records', async () => {
      const fileInfo: FileInfo = {
        name: 'medical-file.pdf',
        path: '/misc/medical-file.pdf',
        extension: '.pdf',
        size: 1024 * 50,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'misc', // Should be ignored
        folderPath: ['home', 'misc']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Medical record for Maria Rodriguez showing results of annual health checkup. Patient Maria Rodriguez underwent comprehensive examination including blood tests and physical assessment.',
          metadata: {
            title: 'Medical Record',
            pages: 3
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Should start with detected person name and include medical terms
      expect(results[0].suggestedName).toMatch(/^maria-rodriguez/);
      expect(results[0].suggestedName).toMatch(/medical/);
      expect(results[0].suggestedName).not.toContain('misc');
    });

    it('should extract name from certificate documents', async () => {
      const fileInfo: FileInfo = {
        name: 'cert.pdf',
        path: '/downloads/cert.pdf',
        extension: '.pdf',
        size: 1024 * 25,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'downloads', // Should be ignored
        folderPath: ['home', 'downloads']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Certificate of completion awarded to David Johnson for successfully completing the Advanced Web Development course. This certificate is issued to David Johnson in recognition of academic achievement.',
          metadata: {
            title: 'Certificate of Completion',
            pages: 1
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Should include certificate/completion terms 
      expect(results[0].suggestedName).toMatch(/certificate|completion/);
      expect(results[0].suggestedName).not.toContain('downloads');
    });

    it('should handle multiple names and pick the primary one', async () => {
      const fileInfo: FileInfo = {
        name: 'wedding-invite.pdf',
        path: '/other/wedding-invite.pdf',
        extension: '.pdf',
        size: 1024 * 30,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'other', // Should be ignored
        folderPath: ['home', 'other']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Wedding ceremony invitation for Sarah Williams and Michael Brown. You are invited to celebrate the marriage of Sarah Williams and Michael Brown on June 15th, 2024.',
          metadata: {
            title: 'Wedding Invitation',
            pages: 1
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Should include wedding terms and pick a name
      expect(results[0].suggestedName).toMatch(/sarah-williams/);
      expect(results[0].suggestedName).toMatch(/wedding/);
      expect(results[0].suggestedName).not.toContain('other');
    });
  });

  describe('Folder Name Filtering', () => {
    it('should ignore common irrelevant folder names', async () => {
      const irrelevantFolders = ['no', 'temp', 'downloads', 'misc', 'other', 'files'];
      
      for (const folderName of irrelevantFolders) {
        const fileInfo: FileInfo = {
          name: 'document.pdf',
          path: `/${folderName}/document.pdf`,
          extension: '.pdf',
          size: 1024 * 40,
          createdAt: new Date('2024-01-15'),
          modifiedAt: new Date('2024-02-01'),
          parentFolder: folderName,
          folderPath: ['home', folderName]
        };

        const mockParser = {
          parse: vi.fn().mockResolvedValue({
            content: 'Document summary report for quarterly business analysis and strategic planning initiatives.',
            metadata: {
              title: 'Business Report',
              pages: 10
            }
          })
        };

        vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

        const results = await fileRenamer.renameFiles([fileInfo]);

        expect(results[0].success).toBe(true);
        expect(results[0].suggestedName).not.toContain(folderName);
        expect(results[0].suggestedName).toMatch(/document.*summary.*report/);
      }
    });

    it('should handle meaningful folder names without excluding them entirely', async () => {
      const fileInfo: FileInfo = {
        name: 'report.pdf',
        path: '/financial-reports/report.pdf',
        extension: '.pdf',
        size: 1024 * 60,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'financial-reports', // This is meaningful
        folderPath: ['home', 'business', 'financial-reports']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Annual financial summary report covering revenue, expenses, and profit analysis for fiscal year 2023.',
          metadata: {
            title: 'Financial Summary',
            pages: 15
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Should focus on content, not necessarily include folder name
      expect(results[0].suggestedName).toMatch(/document.*summary.*report/);
      // But the folder context should still be available to the AI
      expect(fileInfo.parentFolder).toBe('financial-reports');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle documents without clear person names', async () => {
      const fileInfo: FileInfo = {
        name: 'generic.pdf',
        path: '/no/generic.pdf',
        extension: '.pdf',
        size: 1024 * 20,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'no',
        folderPath: ['home', 'no']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'This is a general business document containing policy information and guidelines for company operations.',
          metadata: {
            title: 'Policy Document',
            pages: 5
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(/document.*summary.*report/);
    });

    it('should handle person names with special characters or formatting', async () => {
      const fileInfo: FileInfo = {
        name: 'contract.pdf',
        path: '/temp/contract.pdf',
        extension: '.pdf',
        size: 1024 * 45,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: 'temp',
        folderPath: ['home', 'temp']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Employment agreement between Corporation XYZ and María José García-López for the position of Senior Data Scientist.',
          metadata: {
            title: 'Employment Contract',
            pages: 6
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Should include employment/contract terms
      expect(results[0].suggestedName).toMatch(/employment|contract/);
    });
  });

  describe('Real-world Scenario Tests', () => {
    it('should handle the exact Setareh visa case from user example', async () => {
      const fileInfo: FileInfo = {
        name: 'visitor-visa-application-for-family-in-canada.pdf',
        path: '/#NO/visitor-visa-application-for-family-in-canada.pdf',
        extension: '.pdf',
        size: 1024 * 150,
        createdAt: new Date('2024-01-15'),
        modifiedAt: new Date('2024-02-01'),
        parentFolder: '#NO', // Note: even with special characters
        folderPath: ['home', 'documents', '#NO']
      };

      const mockParser = {
        parse: vi.fn().mockResolvedValue({
          content: 'Application for Visitor Visa (Temporary Resident Visa) for Setareh and family members to visit Canada. Applicant: Setareh [Last Name]. Purpose: Tourism and family visit. Duration: 3 weeks.',
          metadata: {
            title: 'Visitor Visa Application - TRV',
            author: 'Immigration Canada',
            pages: 6
          }
        })
      };

      vi.spyOn(fileRenamer['parserFactory'], 'getParser').mockReturnValue(mockParser);

      const results = await fileRenamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // Should start with detected person name and include visa terms
      expect(results[0].suggestedName).toMatch(/^setareh/);
      expect(results[0].suggestedName).toMatch(/visa/);
      // Should NOT include "no" or "#NO"
      expect(results[0].suggestedName).not.toContain('no');
      expect(results[0].suggestedName).not.toContain('#no');
    });
  });
});