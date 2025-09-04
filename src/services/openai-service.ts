import OpenAI from 'openai';
import { AIProvider } from '../types/index.js';

export class OpenAIService implements AIProvider {
  name = 'OpenAI';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey
    });
  }

  async generateFileName(content: string, originalName: string): Promise<string> {
    const prompt = `Based on the following document content, generate a descriptive filename that captures the main topic/purpose of the document. The filename should be:
- Descriptive and meaningful
- Professional and clean
- Between 3-8 words
- Use kebab-case (lowercase with hyphens)
- Do not include file extension
- Avoid special characters except hyphens

Original filename: ${originalName}

Document content (first 2000 characters):
${content.substring(0, 2000)}

Respond with only the suggested filename, no explanation.`;

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
      return this.sanitizeFileName(suggestedName);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate filename with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private sanitizeFileName(name: string): string {
    // Remove any potential file extensions from the suggestion
    const nameWithoutExt = name.replace(/\.[^/.]+$/, '');
    
    // Convert to lowercase and replace spaces with hyphens
    let cleaned = nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    // Ensure it's not empty and not too long
    if (!cleaned) {
      cleaned = 'untitled-document';
    } else if (cleaned.length > 100) {
      cleaned = cleaned.substring(0, 100).replace(/-[^-]*$/, ''); // Cut at word boundary
    }

    return cleaned;
  }
}