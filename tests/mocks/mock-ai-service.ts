import { AIProvider } from '../../src/types/index.js';

export class MockAIService implements AIProvider {
  name = 'MockAI';
  private mockResponses: Map<string, string> = new Map();
  private shouldFail = false;
  private callCount = 0;

  constructor() {
    // Default mock responses
    this.mockResponses.set('default', 'project-requirements-document');
    this.mockResponses.set('meeting', 'team-meeting-notes-march-2024');
    this.mockResponses.set('report', 'quarterly-sales-report-q1-2024');
  }

  setMockResponse(key: string, response: string): void {
    this.mockResponses.set(key, response);
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }

  async generateFileName(content: string, originalName: string, namingConvention?: string): Promise<string> {
    this.callCount++;

    if (this.shouldFail) {
      throw new Error('Mock AI service failed');
    }

    // Simple logic to return different responses based on content
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes('meeting') || contentLower.includes('attendees')) {
      return this.mockResponses.get('meeting') || 'meeting-notes';
    }
    
    if (contentLower.includes('requirements') || contentLower.includes('project')) {
      return this.mockResponses.get('default') || 'project-document';
    }
    
    if (contentLower.includes('report') || contentLower.includes('sales')) {
      return this.mockResponses.get('report') || 'business-report';
    }

    // Fallback to a generic name based on original filename
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    return `renamed-${baseName}`;
  }
}