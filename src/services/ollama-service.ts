import { AIProvider, FileInfo } from '../types/index.js';

interface OllamaResponse {
  model: string;
  response?: string; // For /api/generate
  message?: {        // For /api/chat
    content: string;
    role: string;
  };
  done: boolean;
}

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OllamaService implements AIProvider {
  name = 'Ollama';
  private baseUrl: string;
  private model: string;

  constructor(
    baseUrl = 'http://localhost:11434',
    model = 'llama3.1'
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
      
      const response = await this.makeRequest('/api/chat', {
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
        ] as OllamaChatMessage[],
        stream: false
      });

      if (response.message?.content) {
        return this.sanitizeFilename(response.message.content);
      } else {
        throw new Error('No response content from Ollama');
      }
    } catch (error) {
      console.error('Ollama API error:', error);
      throw new Error(`Ollama service failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  private async makeRequest(endpoint: string, payload: any): Promise<OllamaResponse> {
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
      throw new Error(`Ollama API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data as OllamaResponse;
  }

  // Method to check if Ollama service is available
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Method to list available models
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