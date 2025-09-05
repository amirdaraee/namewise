import OpenAI from 'openai';
import { AIProvider } from '../types/index.js';
import { applyNamingConvention, getNamingInstructions, NamingConvention } from '../utils/naming-conventions.js';
import { getTemplateInstructions, FileCategory } from '../utils/file-templates.js';

export class OpenAIService implements AIProvider {
  name = 'OpenAI';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey
    });
  }

  async generateFileName(content: string, originalName: string, namingConvention: string = 'kebab-case', category: string = 'general'): Promise<string> {
    const convention = namingConvention as NamingConvention;
    const fileCategory = category as FileCategory;
    const namingInstructions = getNamingInstructions(convention);
    const templateInstructions = getTemplateInstructions(fileCategory);
    
    const prompt = `Based on the following document content, generate a descriptive filename that captures the main topic/purpose of the document. The filename should be:
- Descriptive and meaningful
- Professional and clean
- Between 3-8 words
- ${namingInstructions}
- ${templateInstructions}
- Do not include file extension
- Do not include personal names, dates, or template variables - just the core content description
- Only use letters, numbers, and appropriate separators for the naming convention

Original filename: ${originalName}

Document content (first 2000 characters):
${content.substring(0, 2000)}

Respond with only the core filename (without personal info or dates) using the specified naming convention, no explanation.`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      });

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