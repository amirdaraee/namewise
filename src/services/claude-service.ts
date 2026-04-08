import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, FileInfo } from '../types/index.js';
import { applyNamingConvention, stripWindowsIllegalChars, NamingConvention } from '../utils/naming-conventions.js';
import { FileCategory } from '../utils/file-templates.js';
import { buildFileNamePrompt } from '../utils/ai-prompts.js';

export class ClaudeService implements AIProvider {
  name = 'Claude';
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model ?? 'claude-sonnet-4-5-20250929';
  }

  async generateFileName(content: string, originalName: string, namingConvention: string = 'kebab-case', category: string = 'general', fileInfo?: FileInfo, language?: string): Promise<string> {
    const convention = namingConvention as NamingConvention;
    const fileCategory = category as FileCategory;

    // Check if this is a scanned PDF image
    const isScannedPDF = content.startsWith('[SCANNED_PDF_IMAGE]:');

    try {
      let response;

      if (isScannedPDF) {
        // Extract base64 image data
        const imageBase64 = content.replace('[SCANNED_PDF_IMAGE]:', '');
        if (!imageBase64.startsWith('data:image/') || !imageBase64.includes(',')) {
          throw new Error('Invalid scanned PDF image data format');
        }

        const prompt = buildFileNamePrompt({
          content: 'This is a scanned PDF document converted to an image. Please analyze the image and extract the main content to generate an appropriate filename.',
          originalName,
          namingConvention: convention,
          category: fileCategory,
          fileInfo,
          language
        });

        response = await this.client.messages.create({
          model: this.model,
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
                    data: imageBase64.split(',')[1] // Remove data:image/format;base64, prefix
                  }
                }
              ]
            }
          ]
        });
      } else {
        // Standard text processing
        const prompt = buildFileNamePrompt({
          content,
          originalName,
          namingConvention: convention,
          category: fileCategory,
          fileInfo,
          language
        });

        response = await this.client.messages.create({
          model: this.model,
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });
      }

      const suggestedName = response.content[0].type === 'text' 
        ? response.content[0].text.trim()
        : 'untitled-document';

      // Apply naming convention and clean the suggested name
      return this.sanitizeFileName(suggestedName, convention);
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Failed to generate filename with Claude: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private sanitizeFileName(name: string, convention: NamingConvention): string {
    // Remove any potential file extensions from the suggestion
    const nameWithoutExt = name.replace(/\.[^/.]+$/, '');

    // Strip Windows-illegal characters before applying the naming convention
    const safeForWindows = stripWindowsIllegalChars(nameWithoutExt);

    // Apply the naming convention
    let cleaned = applyNamingConvention(safeForWindows, convention);

    // Ensure it's not empty and not too long
    if (!cleaned) {
      cleaned = applyNamingConvention('untitled document', convention);
    } else if (cleaned.length > 100) {
      // Truncate while preserving naming convention structure
      cleaned = cleaned.substring(0, 100);
      // Clean up any broken separators at the end
      if (convention === 'kebab-case') {
        cleaned = cleaned.replace(/-[^-]*$/, '');
      } else if (convention === 'snake_case') {
        cleaned = cleaned.replace(/_[^_]*$/, '');
      }
    }

    return cleaned;
  }
}