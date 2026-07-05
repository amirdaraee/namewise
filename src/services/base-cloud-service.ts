import { AuthError, NetworkError, RateLimitError } from '../errors.js';
import { AIProvider, FileInfo, AINameResult } from '../types/index.js';
import { NamingConvention } from '../utils/naming-conventions.js';
import { FileCategory } from '../utils/file-templates.js';
import { buildFileNamePrompt } from '../utils/ai-prompts.js';
import { sanitizeCloudFileName } from '../utils/ai-name-sanitizer.js';

/** Shape shared by the Anthropic and OpenAI SDK error classes. */
export interface CloudApiError {
  status?: number;
  message: string;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Shared skeleton for cloud AI providers (Claude, OpenAI): image-data
 * validation, prompt building, filename sanitization, and error mapping.
 * Subclasses supply the SDK calls and response/token extraction.
 */
export abstract class BaseCloudService<TResponse> implements AIProvider {
  readonly name: string;
  protected model: string;

  protected constructor(name: string, model: string) {
    this.name = name;
    this.model = model;
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
      let response: TResponse;

      if (imageData) {
        if (!imageData.startsWith('data:image/') || !imageData.includes(',')) {
          throw new NetworkError('Invalid image data format');
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

        response = await this.createImageCompletion(prompt, imageData);
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

        response = await this.createTextCompletion(prompt);
      }

      const suggestedName = this.extractSuggestedName(response);
      const { inputTokens, outputTokens } = this.extractTokenUsage(response);

      return {
        name: sanitizeCloudFileName(suggestedName, convention),
        inputTokens,
        outputTokens
      };
    } catch (error) {
      if (error instanceof AuthError || error instanceof NetworkError || error instanceof RateLimitError) throw error;
      const apiError = this.asApiError(error);
      if (apiError) {
        if (apiError.status === 401 || apiError.status === 403) {
          throw new AuthError(`${this.name} authentication failed: ${apiError.message}`, { details: { status: apiError.status } });
        }
        if (apiError.status === 429) {
          throw new RateLimitError(`${this.name} rate limit exceeded: ${apiError.message}`, { details: { status: apiError.status } });
        }
        throw new NetworkError(`${this.name} API error (${apiError.status}): ${apiError.message}`, { details: { status: apiError.status } });
      }
      throw new NetworkError(`Failed to generate filename with ${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error });
    }
  }

  /** Sends a text-only completion request to the provider SDK. */
  protected abstract createTextCompletion(prompt: string): Promise<TResponse>;

  /** Sends a vision completion request (prompt + image) to the provider SDK. */
  protected abstract createImageCompletion(prompt: string, imageData: string): Promise<TResponse>;

  /** Extracts the suggested filename text from the SDK response. */
  protected abstract extractSuggestedName(response: TResponse): string;

  /** Extracts token usage from the SDK response. */
  protected abstract extractTokenUsage(response: TResponse): TokenUsage;

  /** Returns the error if it is the provider SDK's APIError, otherwise undefined. */
  protected abstract asApiError(error: unknown): CloudApiError | undefined;
}
