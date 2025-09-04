import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { DocumentParser } from '../types/index.js';

export class ExcelParser implements DocumentParser {
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.xlsx' || ext === '.xls';
  }

  async parse(filePath: string): Promise<string> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheets: string[] = [];

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(sheet);
        if (csvData.trim()) {
          sheets.push(`Sheet: ${sheetName}\\n${csvData}`);
        }
      });

      return sheets.join('\\n\\n').trim();
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}