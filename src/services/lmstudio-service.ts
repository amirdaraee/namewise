import { AIProvider, FileInfo } from '../types/index.js';

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
      const prompt = this.buildPrompt(content, originalName, namingConvention, category, fileInfo);
      
      const response = await this.makeRequest('/v1/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates descriptive filenames based on document content. Always respond with just the filename, no explanation or additional text.'
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
    let prompt = `Based on the following document content, generate a descriptive filename using ${namingConvention} naming convention. `;
    prompt += `The file category is: ${category}. `;
    
    if (fileInfo?.documentMetadata) {
      const meta = fileInfo.documentMetadata;
      if (meta.title) prompt += `Document title: "${meta.title}". `;
      if (meta.author) prompt += `Author: "${meta.author}". `;
      if (meta.subject) prompt += `Subject: "${meta.subject}". `;
    }
    
    if (fileInfo?.parentFolder && fileInfo.parentFolder !== '.') {
      prompt += `Located in folder: "${fileInfo.parentFolder}". `;
    }

    prompt += `\nOriginal filename: ${originalName}\n`;
    prompt += `\nDocument content (first 2000 characters):\n${content.substring(0, 2000)}`;
    prompt += `\n\nGenerate ONLY a descriptive filename (without extension) using ${namingConvention} format. Do not include any explanation or additional text.`;

    return prompt;
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