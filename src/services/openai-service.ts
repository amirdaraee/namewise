import OpenAI from 'openai';
import { AIProvider, FileInfo, AINameResult } from '../types/index.js';
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

  async generateFileName(
    content: string,
    originalName: string,
    namingConvention: string = 'kebab-case',
    category: string = 'general',
    fileInfo?: FileInfo,
    language?: string,
    context?: string,
    imageData?: string
  ): Promise<AINameResult> {
    const convention = namingConvention as NamingConvention;
    const fileCategory = category as FileCategory;

    try {
      let response;

      if (imageData) {
        if (!imageData.startsWith('data:image/') || !imageData.includes(',')) {
          throw new Error('Invalid image data format');
        }

        const prompt = buildFileNamePrompt({
          content: 'Analyze this image and generate an appropriate filename based on what you see.',
          originalName,
          namingConvention: convention,
          category: fileCategory,
          fileInfo,
          language,
          context
        });

        response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageData } }
              ]
            }
          ],
          max_tokens: 100,
          temperature: 0.3
        });
      } else {
        const prompt = buildFileNamePrompt({
          content,
          originalName,
          namingConvention: convention,
          category: fileCategory,
          fileInfo,
          language,
          context
        });

        response = await this.client.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100,
          temperature: 0.3
        });
      }

      const suggestedName = response.choices[0]?.message?.content?.trim() || 'untitled-document';

      return {
        name: this.sanitizeFileName(suggestedName, convention),
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate filename with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private sanitizeFileName(name: string, convention: NamingConvention): string {
    const nameWithoutExt = name.replace(/\.[^/.]+$/, '');
    const safeForWindows = stripWindowsIllegalChars(nameWithoutExt);
    let cleaned = applyNamingConvention(safeForWindows, convention);

    if (!cleaned) {
      cleaned = applyNamingConvention('untitled document', convention);
    } else if (cleaned.length > 100) {
      cleaned = cleaned.substring(0, 100);
      if (convention === 'kebab-case') {
        cleaned = cleaned.replace(/-[^-]*$/, '');
      } else if (convention === 'snake_case') {
        cleaned = cleaned.replace(/_[^_]*$/, '');
      }
    }

    return cleaned;
  }
}
