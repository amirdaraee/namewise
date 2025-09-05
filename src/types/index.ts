export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  content?: string;
}

export interface RenameResult {
  originalPath: string;
  newPath: string;
  suggestedName: string;
  success: boolean;
  error?: string;
}

export interface AIProvider {
  name: string;
  generateFileName: (content: string, originalName: string, namingConvention?: string, category?: string) => Promise<string>;
}

export type NamingConvention = 'kebab-case' | 'snake_case' | 'camelCase' | 'PascalCase' | 'lowercase' | 'UPPERCASE';
export type FileCategory = 'document' | 'movie' | 'music' | 'series' | 'photo' | 'book' | 'general' | 'auto';
export type DateFormat = 'YYYY-MM-DD' | 'YYYY' | 'YYYYMMDD' | 'none';

export interface TemplateOptions {
  category: FileCategory;
  personalName?: string;
  dateFormat: DateFormat;
}

export interface Config {
  aiProvider: 'claude' | 'openai';
  apiKey: string;
  maxFileSize: number;
  supportedExtensions: string[];
  dryRun: boolean;
  namingConvention: NamingConvention;
  templateOptions: TemplateOptions;
}

export interface DocumentParser {
  supports: (filePath: string) => boolean;
  parse: (filePath: string) => Promise<string>;
}