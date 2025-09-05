import { NamingConvention, FileInfo } from '../types/index.js';
import { applyNamingConvention } from './naming-conventions.js';

export type FileCategory = 'document' | 'movie' | 'music' | 'series' | 'photo' | 'book' | 'general' | 'auto';

export interface TemplateOptions {
  personalName?: string;
  dateFormat?: 'YYYY-MM-DD' | 'YYYY' | 'YYYYMMDD' | 'none';
  category?: FileCategory;
}

export interface FileTemplate {
  category: FileCategory;
  pattern: string; // e.g., "{content}-{personalName}-{date}"
  description: string;
  examples: string[];
}

export const FILE_TEMPLATES: Record<Exclude<FileCategory, 'auto'>, FileTemplate> = {
  document: {
    category: 'document',
    pattern: '{content}-{personalName}-{date}',
    description: 'Personal documents with name and date',
    examples: [
      'driving-license-amirhossein-20250213.pdf',
      'dennemeyer-working-contract-amirhossein-20240314.pdf',
      'university-diploma-sarah-20220615.pdf'
    ]
  },
  movie: {
    category: 'movie',
    pattern: '{content}-{year}',
    description: 'Movies with release year',
    examples: [
      'the-dark-knight-2008.mkv',
      'inception-2010.mp4',
      'pulp-fiction-1994.avi'
    ]
  },
  music: {
    category: 'music',
    pattern: '{artist}-{content}',
    description: 'Music files with artist name',
    examples: [
      'the-beatles-hey-jude.mp3',
      'queen-bohemian-rhapsody.flac',
      'pink-floyd-wish-you-were-here.wav'
    ]
  },
  series: {
    category: 'series',
    pattern: '{content}-s{season}e{episode}',
    description: 'TV series with season and episode',
    examples: [
      'breaking-bad-s01e01.mkv',
      'game-of-thrones-s04e09.mp4',
      'the-office-s02e01.avi'
    ]
  },
  photo: {
    category: 'photo',
    pattern: '{content}-{personalName}-{date}',
    description: 'Photos with personal name and date',
    examples: [
      'vacation-paris-john-20240715.jpg',
      'wedding-ceremony-maria-20231009.png',
      'birthday-party-alex-20240320.heic'
    ]
  },
  book: {
    category: 'book',
    pattern: '{author}-{content}',
    description: 'Books with author name',
    examples: [
      'george-orwell-1984.pdf',
      'j-k-rowling-harry-potter-philosophers-stone.epub',
      'stephen-king-the-shining.mobi'
    ]
  },
  general: {
    category: 'general',
    pattern: '{content}',
    description: 'General files without special formatting',
    examples: [
      'meeting-notes-q4-2024.txt',
      'project-requirements.docx',
      'financial-report.xlsx'
    ]
  }
};

export function categorizeFile(filePath: string, content?: string, fileInfo?: FileInfo): FileCategory {
  const extension = getFileExtension(filePath).toLowerCase();
  const fileName = getFileName(filePath).toLowerCase();
  const contentLower = content?.toLowerCase() || '';

  // Use metadata for enhanced categorization
  let metadataHints: string[] = [];
  if (fileInfo?.documentMetadata) {
    const meta = fileInfo.documentMetadata;
    if (meta.title) metadataHints.push(meta.title.toLowerCase());
    if (meta.author) metadataHints.push(meta.author.toLowerCase());
    if (meta.creator) metadataHints.push(meta.creator.toLowerCase());
    if (meta.subject) metadataHints.push(meta.subject.toLowerCase());
    if (meta.keywords) metadataHints.push(...meta.keywords.map(k => k.toLowerCase()));
  }

  // Use folder context for better categorization
  let folderHints: string[] = [];
  if (fileInfo?.folderPath) {
    folderHints = fileInfo.folderPath.map(f => f.toLowerCase());
  }
  if (fileInfo?.parentFolder) {
    folderHints.push(fileInfo.parentFolder.toLowerCase());
  }

  const allHints = [...metadataHints, ...folderHints, contentLower, fileName].join(' ');

  // Document types
  const documentExtensions = ['.pdf', '.docx', '.doc', '.txt', '.rtf'];
  const documentKeywords = ['contract', 'agreement', 'license', 'certificate', 'diploma', 'invoice', 'receipt', 'report', 'application', 'form', 'resume', 'cv', 'letter'];
  
  // Media types
  const movieExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
  const musicExtensions = ['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a'];
  const photoExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.heic', '.webp'];
  const bookExtensions = ['.epub', '.mobi', '.azw', '.azw3'];
  
  // Enhanced series detection
  const seriesKeywords = ['s01', 's02', 's03', 's04', 's05', 'season', 'episode', 'e01', 'e02', 'e03', 'series', 'show', 'tv'];
  
  // Enhanced movie keywords
  const movieKeywords = ['movie', 'film', 'cinema', '1080p', '720p', '4k', 'bluray', 'dvdrip', 'webrip'];
  
  // Book keywords
  const bookKeywords = ['chapter', 'author', 'book', 'novel', 'ebook', 'isbn', 'publisher', 'edition'];
  
  // Music keywords  
  const musicKeywords = ['album', 'track', 'artist', 'band', 'singer', 'song', 'music'];
  
  // Photo keywords
  const photoKeywords = ['photo', 'image', 'picture', 'vacation', 'wedding', 'birthday', 'selfie', 'portrait'];
  
  // Folder-based hints
  const folderMovieHints = ['movies', 'films', 'cinema', 'video'];
  const folderSeriesHints = ['series', 'shows', 'tv', 'television'];
  const folderMusicHints = ['music', 'audio', 'songs', 'albums'];
  const folderPhotoHints = ['photos', 'images', 'pictures', 'gallery'];
  const folderBookHints = ['books', 'ebooks', 'library', 'reading'];
  const folderDocumentHints = ['documents', 'docs', 'papers', 'files'];

  // Check folder context first for strong hints
  if (folderHints.some(hint => folderSeriesHints.includes(hint))) return 'series';
  if (folderHints.some(hint => folderMovieHints.includes(hint))) return 'movie';
  if (folderHints.some(hint => folderMusicHints.includes(hint))) return 'music';
  if (folderHints.some(hint => folderPhotoHints.includes(hint))) return 'photo';
  if (folderHints.some(hint => folderBookHints.includes(hint))) return 'book';
  if (folderHints.some(hint => folderDocumentHints.includes(hint))) return 'document';

  // Check for series first (before movies)
  if (movieExtensions.includes(extension) && (
    seriesKeywords.some(keyword => allHints.includes(keyword))
  )) {
    return 'series';
  }

  // Check by extension with enhanced keyword matching
  if (documentExtensions.includes(extension)) {
    // Check if it's a book
    if (bookExtensions.includes(extension) || bookKeywords.some(keyword => allHints.includes(keyword))) {
      return 'book';
    }
    // Check if it's likely a personal document
    if (documentKeywords.some(keyword => allHints.includes(keyword))) {
      return 'document';
    }
    return 'document'; // Default for document extensions
  }

  // Enhanced media type detection
  if (movieExtensions.includes(extension)) {
    if (movieKeywords.some(keyword => allHints.includes(keyword))) {
      return 'movie';
    }
    return 'movie'; // Default for movie extensions
  }
  
  if (musicExtensions.includes(extension)) {
    if (musicKeywords.some(keyword => allHints.includes(keyword))) {
      return 'music';
    }
    return 'music';
  }
  
  if (photoExtensions.includes(extension)) {
    if (photoKeywords.some(keyword => allHints.includes(keyword))) {
      return 'photo';
    }
    return 'photo';
  }
  
  if (bookExtensions.includes(extension)) return 'book';

  return 'general';
}

export function applyTemplate(
  aiGeneratedName: string,
  category: FileCategory,
  templateOptions: TemplateOptions,
  namingConvention: NamingConvention
): string {
  if (category === 'auto') {
    throw new Error('Cannot apply template for "auto" category. Category should be resolved before calling applyTemplate.');
  }
  const template = FILE_TEMPLATES[category as Exclude<FileCategory, 'auto'>];
  let result = template.pattern;

  // Replace template variables
  result = result.replace('{content}', aiGeneratedName);

  if (templateOptions.personalName) {
    result = result.replace('{personalName}', templateOptions.personalName);
  }

  if (templateOptions.dateFormat && templateOptions.dateFormat !== 'none') {
    const date = formatDate(new Date(), templateOptions.dateFormat);
    result = result.replace('{date}', date);
  }

  // Clean up any remaining unreplaced variables
  result = result.replace(/\{[^}]+\}/g, '');
  
  // Clean up multiple hyphens or other separators
  result = result.replace(/-+/g, '-').replace(/^-|-$/g, '');

  // Apply naming convention
  return applyNamingConvention(result, namingConvention);
}

function formatDate(date: Date, format: 'YYYY-MM-DD' | 'YYYY' | 'YYYYMMDD'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'YYYY':
      return `${year}`;
    case 'YYYYMMDD':
      return `${year}${month}${day}`;
    default:
      return `${year}${month}${day}`;
  }
}

function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
}

function getFileName(filePath: string): string {
  const pathParts = filePath.split(/[/\\]/);
  const fileName = pathParts[pathParts.length - 1];
  return fileName.replace(/\.[^.]*$/, ''); // Remove extension
}

export function getTemplateInstructions(category: FileCategory): string {
  if (category === 'auto') {
    return 'Generate appropriate filename based on detected file type and content.';
  }
  const template = FILE_TEMPLATES[category as Exclude<FileCategory, 'auto'>];
  return `Generate filename for ${category} type files. ${template.description}. Examples: ${template.examples.join(', ')}`;
}