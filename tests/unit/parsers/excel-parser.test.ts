import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExcelParser } from '../../../src/parsers/excel-parser.js';

// Mock exceljs
const mockReadFile = vi.fn();
const mockEachSheet = vi.fn();

vi.mock('exceljs', () => ({
  default: {
    Workbook: vi.fn().mockImplementation(() => ({
      xlsx: { readFile: mockReadFile },
      eachSheet: mockEachSheet,
      properties: {}
    }))
  }
}));

describe('ExcelParser', () => {
  let parser: ExcelParser;

  beforeEach(() => {
    vi.clearAllMocks();
    parser = new ExcelParser();
    mockReadFile.mockResolvedValue(undefined);
    mockEachSheet.mockImplementation(() => {});
  });

  describe('supports()', () => {
    it('should return true for .xlsx files', () => {
      expect(parser.supports('/path/to/file.xlsx')).toBe(true);
    });

    it('should return true for .xls files', () => {
      expect(parser.supports('/path/to/file.xls')).toBe(true);
    });

    it('should return true for uppercase extensions', () => {
      expect(parser.supports('/path/to/file.XLSX')).toBe(true);
      expect(parser.supports('/path/to/file.XLS')).toBe(true);
    });

    it('should return false for .pdf files', () => {
      expect(parser.supports('/path/to/file.pdf')).toBe(false);
    });

    it('should return false for .txt files', () => {
      expect(parser.supports('/path/to/file.txt')).toBe(false);
    });

    it('should return false for .docx files', () => {
      expect(parser.supports('/path/to/file.docx')).toBe(false);
    });
  });

  describe('parse()', () => {
    it('should parse content from multiple sheets', async () => {
      mockEachSheet.mockImplementation((callback: Function) => {
        // Simulate two sheets
        const sheet1 = {
          name: 'Sheet1',
          eachRow: (rowCb: Function) => {
            const row1 = { eachCell: (cellCb: Function) => { cellCb({ value: 'Name' }); cellCb({ value: 'Age' }); } };
            const row2 = { eachCell: (cellCb: Function) => { cellCb({ value: 'Alice' }); cellCb({ value: 30 }); } };
            rowCb(row1);
            rowCb(row2);
          }
        };
        const sheet2 = {
          name: 'Sheet2',
          eachRow: (rowCb: Function) => {
            const row = { eachCell: (cellCb: Function) => { cellCb({ value: 'Data' }); } };
            rowCb(row);
          }
        };
        callback(sheet1, 1);
        callback(sheet2, 2);
      });

      const result = await parser.parse('/path/to/file.xlsx');

      expect(result.content).toContain('Sheet: Sheet1');
      expect(result.content).toContain('Sheet: Sheet2');
      expect(result.content).toContain('Name,Age');
      expect(result.content).toContain('Alice,30');
      expect(result.content).toContain('Data');
      expect(result.metadata).toBeDefined();
    });

    it('should extract metadata from workbook properties', async () => {
      // Need to re-mock workbook with properties
      const Excel = await import('exceljs');
      const MockWorkbook = vi.mocked(Excel.default.Workbook as any);

      MockWorkbook.mockImplementationOnce(() => ({
        xlsx: { readFile: mockReadFile },
        eachSheet: mockEachSheet,
        properties: {
          title: 'Financial Report',
          creator: 'John Smith',
          subject: 'Q4 Analysis',
          keywords: 'finance,report',
          created: new Date('2024-01-15'),
          modified: new Date('2024-02-20')
        }
      }));

      mockEachSheet.mockImplementation((callback: Function) => {
        const sheet = {
          name: 'Data',
          eachRow: (rowCb: Function) => {
            const row = { eachCell: (cellCb: Function) => { cellCb({ value: 'Revenue' }); } };
            rowCb(row);
          }
        };
        callback(sheet, 1);
      });

      const result = await parser.parse('/path/to/financial.xlsx');

      expect(result.metadata.title).toBe('Financial Report');
      expect(result.metadata.author).toBe('John Smith');
      expect(result.metadata.subject).toBe('Q4 Analysis');
      expect(result.metadata.keywords).toEqual(['finance,report']);
      expect(result.metadata.creationDate).toEqual(new Date('2024-01-15'));
      expect(result.metadata.modificationDate).toEqual(new Date('2024-02-20'));
    });

    it('should calculate word count from content', async () => {
      mockEachSheet.mockImplementation((callback: Function) => {
        const sheet = {
          name: 'Sheet1',
          eachRow: (rowCb: Function) => {
            const row = { eachCell: (cellCb: Function) => { cellCb({ value: 'hello world foo bar' }); } };
            rowCb(row);
          }
        };
        callback(sheet, 1);
      });

      const result = await parser.parse('/path/to/file.xlsx');

      expect(result.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should handle empty sheets (no data)', async () => {
      mockEachSheet.mockImplementation((callback: Function) => {
        const sheet = {
          name: 'EmptySheet',
          eachRow: (_rowCb: Function) => {
            // No rows
          }
        };
        callback(sheet, 1);
      });

      const result = await parser.parse('/path/to/empty.xlsx');

      expect(result.content).toBe('');
      expect(result.metadata).toBeDefined();
    });

    it('should handle rows with empty cells', async () => {
      mockEachSheet.mockImplementation((callback: Function) => {
        const sheet = {
          name: 'Sheet1',
          eachRow: (rowCb: Function) => {
            // Row with empty cells (value is null/undefined)
            const emptyRow = {
              eachCell: (cellCb: Function) => {
                cellCb({ value: null });
                cellCb({ value: undefined });
                cellCb({ value: '' });
              }
            };
            rowCb(emptyRow);
          }
        };
        callback(sheet, 1);
      });

      const result = await parser.parse('/path/to/file.xlsx');

      // Empty row data should not create sheet content
      expect(result.content).toBe('');
    });

    it('should throw error when readFile fails', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      await expect(parser.parse('/nonexistent/file.xlsx')).rejects.toThrow(
        'Failed to parse Excel file: File not found'
      );
    });

    it('should handle non-Error exception with unknown error message', async () => {
      mockReadFile.mockRejectedValue('string error');

      await expect(parser.parse('/path/to/file.xlsx')).rejects.toThrow(
        'Failed to parse Excel file: Unknown error'
      );
    });

    it('should extract metadata using core properties when direct props are missing', async () => {
      // Need to re-mock workbook with core properties
      const Excel = await import('exceljs');
      const MockWorkbook = vi.mocked(Excel.default.Workbook as any);

      MockWorkbook.mockImplementationOnce(() => ({
        xlsx: { readFile: mockReadFile },
        eachSheet: mockEachSheet,
        properties: {
          // No direct title/creator/subject etc, use core sub-object
          core: {
            title: 'Core Title',
            creator: 'Core Author',
            subject: 'Core Subject',
            created: new Date('2024-03-01'),
            modified: new Date('2024-03-02')
          }
        }
      }));

      mockEachSheet.mockImplementation((callback: Function) => {
        const sheet = {
          name: 'Data',
          eachRow: (rowCb: Function) => {
            const row = { eachCell: (cellCb: Function) => { cellCb({ value: 'Test' }); } };
            rowCb(row);
          }
        };
        callback(sheet, 1);
      });

      const result = await parser.parse('/path/to/file.xlsx');

      expect(result.metadata.title).toBe('Core Title');
      expect(result.metadata.author).toBe('Core Author');
      expect(result.metadata.subject).toBe('Core Subject');
    });
  });
});
