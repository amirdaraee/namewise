import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, FileInfo } from '../types/index.js';
import { applyNamingConvention, NamingConvention } from '../utils/naming-conventions.js';
import { FileCategory } from '../utils/file-templates.js';
import { buildFileNamePrompt } from '../utils/ai-prompts.js';

export class ClaudeService implements AIProvider {
  name = 'Claude';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey: apiKey
    });
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
        
        const prompt = buildFileNamePrompt({
          content: 'This is a scanned PDF document converted to an image. Please analyze the image and extract the main content to generate an appropriate filename.',
          originalName,
          namingConvention: convention,
          category: fileCategory,
          fileInfo
        });

        response = await this.client.messages.create({
          model: 'claude-3-5-sonnet-20241022', // Use Sonnet for vision capabilities
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
          fileInfo
        });

        response = await this.client.messages.create({
          model: 'claude-3-haiku-20240307',
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
    
    // Apply the naming convention
    let cleaned = applyNamingConvention(nameWithoutExt, convention);

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