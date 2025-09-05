import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { DocumentParser, ParseResult, DocumentMetadata } from '../types/index.js';

export class ExcelParser implements DocumentParser {
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.xlsx' || ext === '.xls';
  }

  async parse(filePath: string): Promise<ParseResult> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheets: string[] = [];
      const metadata: DocumentMetadata = {};

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(sheet);
        if (csvData.trim()) {
          sheets.push(`Sheet: ${sheetName}\\n${csvData}`);
        }
      });

      const content = sheets.join('\\n\\n').trim();
      
      // Extract metadata from workbook properties
      if (workbook.Props) {
        const props = workbook.Props as any;
        metadata.title = props.Title;
        metadata.author = props.Author;
        metadata.subject = props.Subject;
        metadata.keywords = props.Keywords ? [props.Keywords] : undefined;
        metadata.creationDate = props.CreatedDate;
        metadata.modificationDate = props.ModifiedDate;
      }
      
      // Estimate word count from content
      if (content) {
        metadata.wordCount = content.split(/\\s+/).filter(word => word.length > 0).length;
      }

      return { content, metadata };
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}