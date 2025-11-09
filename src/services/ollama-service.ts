import { AIProvider, FileInfo } from '../types/index.js';
import { buildFileNamePrompt, AI_SYSTEM_PROMPT } from '../utils/ai-prompts.js';
import { NamingConvention } from '../utils/naming-conventions.js';
import { FileCategory } from '../utils/file-templates.js';

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
  images?: string[]; // For vision models
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
      // Check if this is a scanned PDF image
      const isScannedPDF = content.startsWith('[SCANNED_PDF_IMAGE]:');
      
      let response;
      
      if (isScannedPDF) {
        // Extract base64 image data and use a vision model
        const imageBase64 = content.replace('[SCANNED_PDF_IMAGE]:', '');
        const imageData = imageBase64.split(',')[1]; // Remove data:image/format;base64, prefix
        
        const prompt = this.buildPrompt(
          'This is a scanned PDF document converted to an image. Please analyze the image and extract the main content to generate an appropriate filename.',
          originalName, 
          namingConvention, 
          category, 
          fileInfo
        );
        
        // Use LLaVA model for vision capabilities
        const visionModel = this.getVisionModel();
        
        response = await this.makeRequest('/api/chat', {
          model: visionModel,
          messages: [
            {
              role: 'system',
              content: AI_SYSTEM_PROMPT
            },
            {
              role: 'user',
              content: prompt,
              images: [imageData]
            }
          ] as OllamaChatMessage[],
          stream: false
        });
      } else {
        // Standard text processing
        const prompt = this.buildPrompt(content, originalName, namingConvention, category, fileInfo);
        
        response = await this.makeRequest('/api/chat', {
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
          ] as OllamaChatMessage[],
          stream: false
        });
      }

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
    return buildFileNamePrompt({
      content,
      originalName,
      namingConvention: namingConvention as NamingConvention,
      category: category as FileCategory,
      fileInfo
    });
  }

  private getVisionModel(): string {
    // Try to use a vision-capable model, fallback to default if not specified
    const visionModels = ['llava', 'llava:7b', 'llava:13b', 'llava:34b', 'llama3.2-vision', 'qwen2-vl'];
    
    // If the current model is already a vision model, use it
    if (visionModels.some(vm => this.model.toLowerCase().includes(vm.split(':')[0]))) {
      return this.model;
    }
    
    // Otherwise, default to llava (most common vision model in Ollama)
    return 'llava';
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