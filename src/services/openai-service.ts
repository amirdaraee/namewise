import OpenAI from 'openai';
import { AIProvider, FileInfo } from '../types/index.js';
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

  async generateFileName(content: string, originalName: string, namingConvention: string = 'kebab-case', category: string = 'general', fileInfo?: FileInfo): Promise<string> {
    const convention = namingConvention as NamingConvention;
    const fileCategory = category as FileCategory;
    const namingInstructions = getNamingInstructions(convention);
    const templateInstructions = getTemplateInstructions(fileCategory);
    
    // Build comprehensive context from all metadata
    let metadataContext = '';
    if (fileInfo) {
      metadataContext += `File Information:
- Original filename: ${originalName}
- File size: ${Math.round(fileInfo.size / 1024)}KB
- Created: ${fileInfo.createdAt.toLocaleDateString()}
- Modified: ${fileInfo.modifiedAt.toLocaleDateString()}
- Parent folder: ${fileInfo.parentFolder}
- Folder path: ${fileInfo.folderPath.join(' > ')}`;

      if (fileInfo.documentMetadata) {
        const meta = fileInfo.documentMetadata;
        metadataContext += `
Document Properties:`;
        if (meta.title) metadataContext += `\n- Title: ${meta.title}`;
        if (meta.author) metadataContext += `\n- Author: ${meta.author}`;
        if (meta.creator) metadataContext += `\n- Creator: ${meta.creator}`;
        if (meta.subject) metadataContext += `\n- Subject: ${meta.subject}`;
        if (meta.keywords?.length) metadataContext += `\n- Keywords: ${meta.keywords.join(', ')}`;
        if (meta.creationDate) metadataContext += `\n- Created: ${meta.creationDate.toLocaleDateString()}`;
        if (meta.modificationDate) metadataContext += `\n- Modified: ${meta.modificationDate.toLocaleDateString()}`;
        if (meta.pages) metadataContext += `\n- Pages: ${meta.pages}`;
        if (meta.wordCount) metadataContext += `\n- Word count: ${meta.wordCount}`;
      }
    }

    const prompt = `Based on the following document information, generate a descriptive filename that captures the main topic/purpose of the document. The filename should be:
- Descriptive and meaningful
- Professional and clean
- Between 3-8 words
- ${namingInstructions}
- ${templateInstructions}
- Do not include file extension
- Do not include personal names, dates, or template variables - just the core content description
- Only use letters, numbers, and appropriate separators for the naming convention
- Use all available context (metadata, folder context, document properties) to create the most accurate filename

${metadataContext}

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