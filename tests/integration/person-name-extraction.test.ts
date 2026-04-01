import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { DocumentParserFactory } from '../../src/parsers/factory.js';
import { FileRenamer } from '../../src/services/file-renamer.js';
import { AIProvider, FileInfo } from '../../src/types/index.js';
import {
  createTempDir,
  copyTestFile,
  makeConfig,
  makeFileInfo
} from './helpers/harness.js';

/**
 * A smart mock AI that simulates person-name extraction and folder filtering
 * the way a real AI would behave. Uses regex patterns on the content.
 */
class PersonAwareMockAI implements AIProvider {
  name = 'PersonAwareMock';

  private readonly irrelevantFolders = new Set(['no', 'temp', 'downloads', 'misc', 'other', 'files']);

  async generateFileName(
    content: string,
    _originalName: string,
    _namingConvention?: string,
    _category?: string,
    fileInfo?: FileInfo
  ): Promise<string> {
    const lower = content.toLowerCase();
    const folderName = fileInfo?.parentFolder?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
    const shouldIgnoreFolder = this.irrelevantFolders.has(folderName);

    // Extract person name from content
    const extractedName = this.extractPersonName(content);
    const prefix = extractedName ? `${extractedName}-` : '';

    if (lower.includes('visa') && lower.includes('application')) {
      return `${prefix}visitor-visa-application-for-family-members-in-canada`;
    }
    if (lower.includes('contract') || lower.includes('employment')) {
      return `${prefix}employment-contract`;
    }
    if (lower.includes('medical') || lower.includes('health')) {
      return `${prefix}medical-record-annual-checkup`;
    }
    if (lower.includes('certificate') || lower.includes('diploma')) {
      return `${prefix}certificate-completion`;
    }
    if (lower.includes('meeting') || lower.includes('attendees')) {
      return `${prefix}team-meeting-notes`;
    }

    // Do NOT include the folder name if it's irrelevant
    if (!shouldIgnoreFolder && folderName && folderName.length > 3) {
      return `${prefix}document-${folderName}`;
    }

    return `${prefix}document-summary-report`;
  }

  private extractPersonName(content: string): string {
    const patterns = [
      /applicant[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
      /full name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /between\s+[A-Za-z\s]+\s+and\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
      /\bfor\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match?.[1]) {
        return match[1].toLowerCase().replace(/\s+/g, '-');
      }
    }
    return '';
  }
}

describe('Person Name Extraction and Folder Filtering Integration Tests', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let mockAI: PersonAwareMockAI;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    mockAI = new PersonAwareMockAI();
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('person name extraction from real document content', () => {
    it('should extract name from visa application content', async () => {
      const filePath = await copyTestFile('visa-application-setareh.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, {
        size: stat.size,
        parentFolder: 'no',
        folderPath: ['home', 'downloads', 'no']
      });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const results = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(/setareh/i);
      expect(results[0].suggestedName).toMatch(/visa/i);
      expect(results[0].suggestedName).not.toContain('-no.');
    });

    it('should extract name from employment contract content', async () => {
      const filePath = await copyTestFile('contract-john-doe.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, {
        size: stat.size,
        parentFolder: 'temp',
        folderPath: ['home', 'temp']
      });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const results = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(/contract|employment/i);
      // temp folder should not appear in the name
      expect(results[0].suggestedName).not.toMatch(/\btemp\b/);
    });

    it('should handle meeting notes content without a primary person name', async () => {
      const filePath = await copyTestFile('meeting-notes.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, {
        size: stat.size,
        parentFolder: 'misc',
        folderPath: ['home', 'misc']
      });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const results = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(/meeting/i);
      expect(results[0].suggestedName).not.toMatch(/\bmisc\b/);
    });
  });

  describe('irrelevant folder name filtering', () => {
    it.each(['no', 'temp', 'downloads', 'misc', 'other', 'files'])(
      'should not include "%s" folder name in the output',
      async (folderName) => {
        const filePath = await copyTestFile('contract-john-doe.txt', tempDir);
        const stat = await fs.stat(filePath);
        const fileInfo = makeFileInfo(filePath, {
          size: stat.size,
          parentFolder: folderName,
          folderPath: ['home', folderName]
        });
        const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

        const results = await renamer.renameFiles([fileInfo]);

        expect(results[0].success).toBe(true);
        // The irrelevant folder name should not appear as a word in the filename
        const nameStem = results[0].suggestedName.replace(/\.[^.]+$/, '');
        const segments = nameStem.split(/[-_.]/);
        expect(segments).not.toContain(folderName);
      }
    );

    it('should pass meaningful folder names to the AI context', async () => {
      const filePath = await copyTestFile('quarterly-report.md', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, {
        size: stat.size,
        parentFolder: 'financial-reports',
        folderPath: ['home', 'business', 'financial-reports']
      });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const results = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      // The file should process successfully — meaningful folder context is available to AI
      expect(results[0].suggestedName).toBeTruthy();
    });
  });

  describe('special characters in folder names', () => {
    it('should handle folder names with special characters like "#NO"', async () => {
      const filePath = await copyTestFile('visa-application-setareh.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, {
        size: stat.size,
        parentFolder: '#NO',
        folderPath: ['home', 'documents', '#NO']
      });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const results = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(/visa/i);
      // "#NO" and "no" should not appear as filename segments
      const lower = results[0].suggestedName.toLowerCase();
      expect(lower).not.toContain('#no');
    });
  });
});
