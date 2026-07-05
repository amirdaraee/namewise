import { AIProvider, FileInfo, AINameResult } from '../types/index.js';
import { buildFileNamePrompt } from '../utils/ai-prompts.js';
import { NamingConvention } from '../utils/naming-conventions.js';
import { FileCategory } from '../utils/file-templates.js';
import { AuthError, NetworkError, RateLimitError, ConfigError } from '../errors.js';
import { sanitizeLocalFileName } from '../utils/ai-name-sanitizer.js';

/**
 * Shared skeleton for local AI providers (Ollama, LMStudio): localhost URL
 * validation, HTTP request/status mapping, and the generateFileName flow.
 * Subclasses supply the chat request payload and response extraction.
 */
export abstract class BaseLocalService<TRequest, TResponse> implements AIProvider {
  readonly name: string;
  protected baseUrl: string;
  protected model: string;

  protected constructor(name: string, baseUrl: string, model: string) {
    this.name = name;
    this.baseUrl = this.validateLocalUrl(baseUrl);
    this.model = model;
  }

  private validateLocalUrl(url: string): string {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ConfigError(`Invalid ${this.name} base URL: ${url}`);
    }
    const hostname = parsed.hostname.toLowerCase();
    const allowed = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
    if (!allowed) {
      throw new ConfigError(`${this.name} base URL must point to localhost (got: ${hostname})`);
    }
    return url;
  }

  async generateFileName(
    content: string,
    originalName: string,
    namingConvention = 'kebab-case',
    category = 'general',
    fileInfo?: FileInfo,
    language?: string,
    context?: string,
    imageData?: string
  ): Promise<AINameResult> {
    try {
      if (imageData && (!imageData.startsWith('data:image/') || !imageData.includes(','))) {
        throw new NetworkError('Invalid image data format');
      }

      const prompt = buildFileNamePrompt({
        content: imageData
          ? 'Analyze this image and generate an appropriate filename based on what you see.'
          : content,
        originalName,
        namingConvention: namingConvention as NamingConvention,
        category: category as FileCategory,
        fileInfo,
        language,
        context
      });

      const responseContent = await this.requestCompletion(prompt, imageData);

      if (responseContent) {
        return { name: sanitizeLocalFileName(responseContent), inputTokens: undefined, outputTokens: undefined };
      }
      throw new NetworkError(`No response content from ${this.name}`);
    } catch (error) {
      if (error instanceof AuthError || error instanceof NetworkError || error instanceof RateLimitError || error instanceof ConfigError) throw error;
      throw new NetworkError(`${this.name} service failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error });
    }
  }

  /** Sends the chat request and returns the raw response content, if any. */
  protected abstract requestCompletion(prompt: string, imageData?: string): Promise<string | undefined>;

  protected async makeRequest(endpoint: string, payload: TRequest): Promise<TResponse> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new AuthError(`${this.name} authentication failed`, { details: { status: response.status, body: errorText } });
      }
      if (response.status === 429) {
        throw new RateLimitError(`${this.name} rate limit exceeded`, { details: { status: response.status } });
      }
      throw new NetworkError(`${this.name} API request failed: ${response.status} ${response.statusText}`, { details: { status: response.status, body: errorText } });
    }

    return response.json() as Promise<TResponse>;
  }
}
