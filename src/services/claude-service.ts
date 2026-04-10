import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, FileInfo, AINameResult } from '../types/index.js';
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

        response = await this.client.messages.create({
          model: this.model,
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: imageData.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
                    data: imageData.split(',')[1]
                  }
                }
              ]
            }
          ]
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

        response = await this.client.messages.create({
          model: this.model,
          max_tokens: 100,
          messages: [{ role: 'user', content: prompt }]
        });
      }

      const suggestedName = response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : 'untitled-document';

      return {
        name: this.sanitizeFileName(suggestedName, convention),
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens
      };
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Failed to generate filename with Claude: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
