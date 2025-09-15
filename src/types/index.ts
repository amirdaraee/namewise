export interface DocumentMetadata {
  title?: string;
  author?: string;
  creator?: string;
  subject?: string;
  keywords?: string[];
  creationDate?: Date;
  modificationDate?: Date;
  pages?: number;
  wordCount?: number;
}

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  content?: string;
  // File system metadata
  createdAt: Date;
  modifiedAt: Date;
  accessedAt: Date;
  // Context metadata  
  parentFolder: string;
  folderPath: string[];
  // Document metadata (extracted from file contents)
  documentMetadata?: DocumentMetadata;
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
  generateFileName: (content: string, originalName: string, namingConvention?: string, category?: string, fileInfo?: FileInfo) => Promise<string>;
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
  aiProvider: 'claude' | 'openai' | 'ollama' | 'lmstudio';
  apiKey?: string; // Optional for local providers
  maxFileSize: number;
  supportedExtensions: string[];
  dryRun: boolean;
  namingConvention: NamingConvention;
  templateOptions: TemplateOptions;
  // Local LLM specific options
  localLLMConfig?: {
    baseUrl?: string;
    model?: string;
  };
}

export interface ParseResult {
  content: string;
  metadata?: DocumentMetadata;
}

export interface DocumentParser {
  supports: (filePath: string) => boolean;
  parse: (filePath: string) => Promise<ParseResult>;
}