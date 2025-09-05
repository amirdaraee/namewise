# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2025-09-05

### Added
- **Naming Convention Customization**: Added `-c, --case` option to choose naming convention
  - `kebab-case`: lowercase-with-hyphens (default)
  - `snake_case`: lowercase_with_underscores  
  - `camelCase`: camelCaseFormat
  - `PascalCase`: PascalCaseFormat
  - `lowercase`: lowercaseformat
  - `UPPERCASE`: UPPERCASEFORMAT
- AI services now receive naming convention instructions and generate appropriately formatted filenames
- Enhanced filename sanitization with convention-aware processing

### Example Usage
```bash
# Use snake_case naming
namewise rename ./docs --case snake_case --dry-run

# Use camelCase naming  
namewise rename ./docs --case camelCase --provider openai
```

## [0.1.5] - 2025-09-05

### Improved
- Enhanced CLI user experience with single-line progress display that updates in place
- Improved results output format: clear `original-name → new-name` display instead of confusing double checkmarks
- Added progress counter showing current file being processed `(3/7)`
- Cleaner console output with proper line clearing after processing

## [0.1.4] - 2025-09-05

### Fixed
- Fixed console output formatting where `\n` was displayed as literal text instead of newlines
- Console output now properly displays line breaks for better readability

## [0.1.3] - 2025-09-05

### Changed
- Package renamed from `ai-rename` to `namewise` (clearer branding and avoids confusion with existing ai-renamer package)
- CLI binary name changed from `ai-rename` to `namewise`
- All documentation and references updated to reflect new name

## [0.1.1] - 2025-09-05

### Changed
- Package renamed from `smart-rename` to `ai-rename` (original name was taken on NPM)
- CLI binary name changed from `smart-rename` to `ai-rename`
- All documentation and references updated to reflect new name

## [0.1.0] - 2025-09-05

### Added
- Initial beta release of AI Rename
- AI-powered file renaming using Claude or OpenAI
- Support for PDF, Word, Excel, and text files
- Dry-run mode for safe previewing
- File conflict detection and prevention
- Configurable file size limits
- Interactive API key prompts
- Comprehensive test suite (65 tests, 90%+ branch coverage)
- CLI with intuitive commands and options

### Features
- **Document Parsers**: PDF, DOCX, DOC, XLSX, XLS, TXT, MD, RTF
- **AI Providers**: Claude (Anthropic) and OpenAI support
- **Safety Features**: Dry-run mode, conflict detection, error handling
- **Configuration**: Flexible options for provider, API keys, and file sizes

### Technical
- TypeScript implementation with strict typing
- ESM module support
- Node.js 18+ compatibility
- Vitest testing framework
- Commander.js CLI framework