import { FileInfo } from '../types/index.js';
import { getNamingInstructions, NamingConvention } from './naming-conventions.js';
import { getTemplateInstructions, FileCategory } from './file-templates.js';

export interface PromptContext {
  content: string;
  originalName: string;
  namingConvention: NamingConvention;
  category: FileCategory;
  fileInfo?: FileInfo;
}

/**
 * Builds a standardized prompt for AI filename generation
 * This prompt is used across all AI providers (Claude, OpenAI, LMStudio, Ollama)
 */
export function buildFileNamePrompt(context: PromptContext): string {
  const { content, originalName, namingConvention, category, fileInfo } = context;
  
  const namingInstructions = getNamingInstructions(namingConvention);
  const templateInstructions = getTemplateInstructions(category);
  
  // Build comprehensive context from all metadata
  let metadataContext = '';
  if (fileInfo) {
    metadataContext += `File Information:
- Original filename: ${originalName}
- File size: ${Math.round(fileInfo.size / 1024)}KB
- Created: ${fileInfo.createdAt.toLocaleDateString()}
- Modified: ${fileInfo.modifiedAt.toLocaleDateString()}
- Parent folder: ${fileInfo.parentFolder}
- Folder path: ${fileInfo.folderPath.join(' > ')}`;

    if (fileInfo.documentMetadata) {
      const meta = fileInfo.documentMetadata;
      metadataContext += `
Document Properties:`;
      if (meta.title) metadataContext += `\n- Title: ${meta.title}`;
      if (meta.author) metadataContext += `\n- Author: ${meta.author}`;
      if (meta.creator) metadataContext += `\n- Creator: ${meta.creator}`;
      if (meta.subject) metadataContext += `\n- Subject: ${meta.subject}`;
      if (meta.keywords?.length) metadataContext += `\n- Keywords: ${meta.keywords.join(', ')}`;
      if (meta.creationDate) metadataContext += `\n- Created: ${meta.creationDate.toLocaleDateString()}`;
      if (meta.modificationDate) metadataContext += `\n- Modified: ${meta.modificationDate.toLocaleDateString()}`;
      if (meta.pages) metadataContext += `\n- Pages: ${meta.pages}`;
      if (meta.wordCount) metadataContext += `\n- Word count: ${meta.wordCount}`;
    }
  }

  return `Based on the following document information, generate a descriptive filename that captures the main topic/purpose of the document. The filename should be:
- Descriptive and meaningful
- Professional and clean
- Between 3-10 words
- ${namingInstructions}
- ${templateInstructions}
- Do not include file extension
- If the document is specifically for/about a person (based on content), include their name at the beginning
- Include dates only if they are essential to the document's identity (e.g., contracts, certificates)
- Ignore irrelevant folder names that don't describe the document content
- Only use letters, numbers, and appropriate separators for the naming convention
- Focus on the document's actual content and purpose, not just metadata

${metadataContext}

Document content (first 2000 characters):
${content.substring(0, 2000)}

Important: If this document is specifically for or about a particular person mentioned in the content, start the filename with their name. Otherwise, focus on the document's main purpose and content.

Respond with only the filename using the specified naming convention, no explanation.`;
}

/**
 * System prompt for AI models that need a separate system message
 */
export const AI_SYSTEM_PROMPT = 'You are a helpful assistant that generates descriptive filenames based on document content. Always respond with just the filename, no explanation or additional text.';