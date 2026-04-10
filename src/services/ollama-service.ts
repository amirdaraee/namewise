import { AIProvider, FileInfo, AINameResult } from '../types/index.js';
import { buildFileNamePrompt, AI_SYSTEM_PROMPT } from '../utils/ai-prompts.js';
import { NamingConvention } from '../utils/naming-conventions.js';
import { FileCategory } from '../utils/file-templates.js';

interface OllamaResponse {
  model: string;
  response?: string;
  message?: { content: string; role: string };
  done: boolean;
}

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

export class OllamaService implements AIProvider {
  name = 'Ollama';
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = 'http://localhost:11434', model = 'llama3.1') {
    this.baseUrl = this.validateLocalUrl(baseUrl);
    this.model = model;
  }

  private validateLocalUrl(url: string): string {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid Ollama base URL: ${url}`);
    }
    const hostname = parsed.hostname.toLowerCase();
    const allowed = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
    if (!allowed) {
      throw new Error(`Ollama base URL must point to localhost (got: ${hostname})`);
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
        throw new Error('Invalid image data format');
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

      const userMessage: OllamaChatMessage = imageData
        ? { role: 'user', content: prompt, images: [imageData.split(',')[1]] }
        : { role: 'user', content: prompt };

      const response = await this.makeRequest('/api/chat', {
        model: this.model,
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          userMessage
        ] as OllamaChatMessage[],
        stream: false
      });

      if (response.message?.content) {
        return { name: this.sanitizeFilename(response.message.content), inputTokens: undefined, outputTokens: undefined };
      }
      throw new Error('No response content from Ollama');
    } catch (error) {
      console.error('Ollama API error:', error);
      throw new Error(`Ollama service failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/\.(txt|pdf|docx?|xlsx?|md|rtf)$/i, '')
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  private async makeRequest(endpoint: string, payload: any): Promise<OllamaResponse> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json() as Promise<OllamaResponse>;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch {
      return [];
    }
  }
}
