# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-09-05

### Added
- Initial beta release of Smart Rename
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