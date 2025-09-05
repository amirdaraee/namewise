export type NamingConvention = 'kebab-case' | 'snake_case' | 'camelCase' | 'PascalCase' | 'lowercase' | 'UPPERCASE';

export function applyNamingConvention(text: string, convention: NamingConvention): string {
  // First, normalize the text by removing special characters and extra spaces
  const normalized = text
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, ' ')      // Normalize spaces
    .trim();

  switch (convention) {
    case 'kebab-case':
      return normalized
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[_]/g, '-');

    case 'snake_case':
      return normalized
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[-]/g, '_');

    case 'camelCase':
      return normalized
        .split(/[\s\-_]+/)
        .map((word, index) => 
          index === 0 
            ? word.toLowerCase() 
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');

    case 'PascalCase':
      return normalized
        .split(/[\s\-_]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');

    case 'lowercase':
      return normalized
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[-_]/g, '');

    case 'UPPERCASE':
      return normalized
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[-_]/g, '');

    default:
      return normalized.replace(/\s+/g, '-').toLowerCase(); // Default to kebab-case
  }
}

export function getNamingInstructions(convention: NamingConvention): string {
  const instructions = {
    'kebab-case': 'Use lowercase with hyphens between words (e.g., "meeting-notes-2024")',
    'snake_case': 'Use lowercase with underscores between words (e.g., "meeting_notes_2024")', 
    'camelCase': 'Use camelCase format starting with lowercase (e.g., "meetingNotes2024")',
    'PascalCase': 'Use PascalCase format starting with uppercase (e.g., "MeetingNotes2024")',
    'lowercase': 'Use single lowercase word with no separators (e.g., "meetingnotes2024")',
    'UPPERCASE': 'Use single uppercase word with no separators (e.g., "MEETINGNOTES2024")'
  };

  return instructions[convention];
}