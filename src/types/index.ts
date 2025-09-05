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
  generateFileName: (content: string, originalName: string, namingConvention?: string) => Promise<string>;
}

export type NamingConvention = 'kebab-case' | 'snake_case' | 'camelCase' | 'PascalCase' | 'lowercase' | 'UPPERCASE';

export interface Config {
  aiProvider: 'claude' | 'openai';
  apiKey: string;
  maxFileSize: number;
  supportedExtensions: string[];
  dryRun: boolean;
  namingConvention: NamingConvention;
}

export interface DocumentParser {
  supports: (filePath: string) => boolean;
  parse: (filePath: string) => Promise<string>;
}