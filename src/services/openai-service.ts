import OpenAI from 'openai';
import { AIProvider, FileInfo } from '../types/index.js';
import { applyNamingConvention, stripWindowsIllegalChars, NamingConvention } from '../utils/naming-conventions.js';
import { FileCategory } from '../utils/file-templates.js';
import { buildFileNamePrompt } from '../utils/ai-prompts.js';

export class OpenAIService implements AIProvider {
  name = 'OpenAI';
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model ?? 'gpt-4o';
  }

  async generateFileName(content: string, originalName: string, namingConvention: string = 'kebab-case', category: string = 'general', fileInfo?: FileInfo): Promise<string> {
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
          fileInfo
        });

        response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageBase64
                  }
                }
              ]
            }
          ],
          max_tokens: 100,
          temperature: 0.3
        });
      } else {
        // Standard text processing
        const prompt = buildFileNamePrompt({
          content,
          originalName,
          namingConvention: convention,
          category: fileCategory,
          fileInfo
        });

        response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 100,
          temperature: 0.3
        });
      }

      const suggestedName = response.choices[0]?.message?.content?.trim() || 'untitled-document';
      
      // Clean and validate the suggested name
      return this.sanitizeFileName(suggestedName, convention);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate filename with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
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