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
  generateFileName: (content: string, originalName: string) => Promise<string>;
}

export interface Config {
  aiProvider: 'claude' | 'openai';
  apiKey: string;
  maxFileSize: number;
  supportedExtensions: string[];
  dryRun: boolean;
}

export interface DocumentParser {
  supports: (filePath: string) => boolean;
  parse: (filePath: string) => Promise<string>;
}