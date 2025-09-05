import path from 'path';
import Excel from 'exceljs';
import { DocumentParser, ParseResult, DocumentMetadata } from '../types/index.js';

export class ExcelParser implements DocumentParser {
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.xlsx' || ext === '.xls';
  }

  async parse(filePath: string): Promise<ParseResult> {
    try {
      const workbook = new Excel.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const sheets: string[] = [];
      const metadata: DocumentMetadata = {};

      // Extract content from each worksheet
      workbook.eachSheet((worksheet) => {
        const sheetName = worksheet.name;
        const rows: string[] = [];
        
        worksheet.eachRow((row) => {
          const rowData: string[] = [];
          row.eachCell((cell) => {
            // Get cell value as string
            const cellValue = cell.value?.toString() || '';
            if (cellValue) {
              rowData.push(cellValue);
            }
          });
          if (rowData.length > 0) {
            rows.push(rowData.join(','));
          }
        });
        
        if (rows.length > 0) {
          sheets.push(`Sheet: ${sheetName}\n${rows.join('\n')}`);
        }
      });

      const content = sheets.join('\n\n').trim();
      
      // Extract metadata from workbook properties
      if (workbook.properties) {
        const props = workbook.properties as any; // ExcelJS properties typing may vary
        metadata.title = props.title || props.core?.title;
        metadata.author = props.creator || props.core?.creator;
        metadata.subject = props.subject || props.core?.subject;
        metadata.keywords = props.keywords ? [props.keywords] : undefined;
        metadata.creationDate = props.created || props.core?.created;
        metadata.modificationDate = props.modified || props.core?.modified;
      }
      
      // Estimate word count from content
      if (content) {
        metadata.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      }

      return { content, metadata };
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}