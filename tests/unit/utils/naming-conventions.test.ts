import { describe, it, expect } from 'vitest';
import { applyNamingConvention, getNamingInstructions, NamingConvention } from '../../../src/utils/naming-conventions.js';

describe('Naming Conventions', () => {
  describe('applyNamingConvention()', () => {
    const testText = 'Project Requirements Document 2024';

    it('should apply kebab-case convention', () => {
      const result = applyNamingConvention(testText, 'kebab-case');
      expect(result).toBe('project-requirements-document-2024');
    });

    it('should apply snake_case convention', () => {
      const result = applyNamingConvention(testText, 'snake_case');
      expect(result).toBe('project_requirements_document_2024');
    });

    it('should apply camelCase convention', () => {
      const result = applyNamingConvention(testText, 'camelCase');
      expect(result).toBe('projectRequirementsDocument2024');
    });

    it('should apply PascalCase convention', () => {
      const result = applyNamingConvention(testText, 'PascalCase');
      expect(result).toBe('ProjectRequirementsDocument2024');
    });

    it('should apply lowercase convention', () => {
      const result = applyNamingConvention(testText, 'lowercase');
      expect(result).toBe('projectrequirementsdocument2024');
    });

    it('should apply UPPERCASE convention', () => {
      const result = applyNamingConvention(testText, 'UPPERCASE');
      expect(result).toBe('PROJECTREQUIREMENTSDOCUMENT2024');
    });

    it('should handle text with special characters', () => {
      const textWithSpecialChars = 'User@Guide & Manual (v2.1)';
      
      expect(applyNamingConvention(textWithSpecialChars, 'kebab-case')).toBe('userguide-manual-v21');
      expect(applyNamingConvention(textWithSpecialChars, 'snake_case')).toBe('userguide_manual_v21');
      expect(applyNamingConvention(textWithSpecialChars, 'camelCase')).toBe('userguideManualV21');
      expect(applyNamingConvention(textWithSpecialChars, 'PascalCase')).toBe('UserguideManualV21');
    });

    it('should handle text with existing hyphens and underscores', () => {
      const textWithSeparators = 'my-file_name document';
      
      expect(applyNamingConvention(textWithSeparators, 'kebab-case')).toBe('my-file-name-document');
      expect(applyNamingConvention(textWithSeparators, 'snake_case')).toBe('my_file_name_document');
      expect(applyNamingConvention(textWithSeparators, 'camelCase')).toBe('myFileNameDocument');
    });

    it('should handle empty and whitespace-only strings', () => {
      expect(applyNamingConvention('', 'kebab-case')).toBe('');
      expect(applyNamingConvention('   ', 'kebab-case')).toBe('');
    });

    it('should normalize multiple spaces', () => {
      const textWithSpaces = 'Meeting   Notes    From   Today';
      expect(applyNamingConvention(textWithSpaces, 'kebab-case')).toBe('meeting-notes-from-today');
    });

    it('should default to kebab-case for unknown convention', () => {
      const result = applyNamingConvention(testText, 'unknown' as NamingConvention);
      expect(result).toBe('project-requirements-document-2024');
    });
  });

  describe('getNamingInstructions()', () => {
    it('should return correct instructions for each convention', () => {
      expect(getNamingInstructions('kebab-case')).toContain('lowercase with hyphens');
      expect(getNamingInstructions('snake_case')).toContain('lowercase with underscores');
      expect(getNamingInstructions('camelCase')).toContain('camelCase format starting with lowercase');
      expect(getNamingInstructions('PascalCase')).toContain('PascalCase format starting with uppercase');
      expect(getNamingInstructions('lowercase')).toContain('single lowercase word');
      expect(getNamingInstructions('UPPERCASE')).toContain('single uppercase word');
    });

    it('should include examples in instructions', () => {
      expect(getNamingInstructions('kebab-case')).toContain('meeting-notes-2024');
      expect(getNamingInstructions('snake_case')).toContain('meeting_notes_2024');
      expect(getNamingInstructions('camelCase')).toContain('meetingNotes2024');
      expect(getNamingInstructions('PascalCase')).toContain('MeetingNotes2024');
    });
  });
});