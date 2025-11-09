import { AIProvider, FileInfo } from '../types/index.js';
import { buildFileNamePrompt, AI_SYSTEM_PROMPT } from '../utils/ai-prompts.js';
import { NamingConvention } from '../utils/naming-conventions.js';
import { FileCategory } from '../utils/file-templates.js';

interface OpenAICompatibleResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export class LMStudioService implements AIProvider {
  name = 'LMStudio';
  private baseUrl: string;
  private model: string;

  constructor(
    baseUrl = 'http://localhost:1234',
    model = 'local-model'
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generateFileName(
    content: string, 
    originalName: string, 
    namingConvention = 'kebab-case', 
    category = 'general',
    fileInfo?: FileInfo
  ): Promise<string> {
    try {
      // Check if this is a scanned PDF image
      const isScannedPDF = content.startsWith('[SCANNED_PDF_IMAGE]:');
      
      if (isScannedPDF) {
        // LM Studio has limited vision support, so we'll fall back to using the original filename
        console.log('⚠️ Scanned PDF detected but LMStudio has limited vision support. Using original filename.');
        return this.sanitizeFilename(originalName);
      }
      
      const prompt = this.buildPrompt(content, originalName, namingConvention, category, fileInfo);
      
      const response = await this.makeRequest('/v1/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: AI_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: prompt
          }
        ] as OpenAIMessage[],
        temperature: 0.3,
        max_tokens: 100,
        stream: false
      });

      if (response.choices?.[0]?.message?.content) {
        return this.sanitizeFilename(response.choices[0].message.content);
      } else {
        throw new Error('No response content from LMStudio');
      }
    } catch (error) {
      console.error('LMStudio API error:', error);
      throw new Error(`LMStudio service failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPrompt(
    content: string, 
    originalName: string, 
    namingConvention: string, 
    category: string,
    fileInfo?: FileInfo
  ): string {
    return buildFileNamePrompt({
      content,
      originalName,
      namingConvention: namingConvention as NamingConvention,
      category: category as FileCategory,
      fileInfo
    });
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .trim()
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\.(txt|pdf|docx?|xlsx?|md|rtf)$/i, '') // Remove extensions
      .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase();
  }

  private async makeRequest(endpoint: string, payload: any): Promise<OpenAICompatibleResponse> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LMStudio API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data as OpenAICompatibleResponse;
  }

  // Method to check if LMStudio service is available
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Method to list available models
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.data?.map((model: ModelInfo) => model.id) || [];
    } catch {
      return [];
    }
  }
}