# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.1] - 2026-04-02

### Fixed
- Movie, music, series, and book templates now produce correct filenames; the AI is explicitly instructed to include the release year, artist name, season/episode, or author in the output rather than leaving unfilled `{year}`, `{artist}`, `{author}`, `{season}`, `{episode}` placeholders that were silently stripped
- `--date` flag for document and photo templates now uses the document's own creation date from file metadata when available, instead of always substituting today's date

### Changed
- `--model` flag now works for all providers (Claude, OpenAI, Ollama, LMStudio), not just local LLMs; defaults are `claude-sonnet-4-5-20250929` for Claude and `gpt-4o` for OpenAI
- Content sent to AI increased from 2000 to 5000 characters for more accurate filename generation on longer documents

## [0.6.0] - 2026-04-02

### Added
- `--recursive` / `-r` flag to scan subdirectories, with optional `--depth <n>` to limit depth
- `namewise undo [session-id]` command to reverse any previous rename session
- `namewise undo --list` to view recent sessions with their IDs
- Cascading config file support: `~/.namewise.json` (user) and `<dir>/.namewise.json` (project); CLI flags take highest priority
- `--concurrency <n>` flag to process files in parallel (default: 3)
- `--output <path>` flag to save a full JSON rename report after each run

### Changed
- Conflict handling: instead of erroring when a target filename already exists, the tool now auto-numbers the new file (`report-2.pdf`, `report-3.pdf`, etc.)
- Rename history is now saved to `~/.namewise/history.json` after every run

## [0.5.4] - 2026-03-31

### Changed
- Achieved 100% test coverage across all metrics (statements, branches, functions, lines)
- Expanded test suite to 325 tests across 26 test files

## [0.5.0] - 2025-11-10

### Added
- Scanned PDF support: image-only PDFs are automatically detected and sent to vision AI for analysis
- Automatic image optimization to stay within the Claude 5MB API limit (progressive JPEG compression and dimension scaling)

### Changed
- Replaced `pdfjs-dist` with `pdf-to-png-converter` for more reliable PDF-to-image conversion in Node.js
- Updated default Claude model to claude-sonnet-4-5-20250929

### Fixed
- "Image or Canvas expected" errors when processing scanned PDFs
- "image exceeds 5 MB maximum" errors with large scanned documents
- Deprecated model warnings from the Anthropic API

## [0.4.1] - 2025-09-15

### Changed
- Improved stability and consistency across all AI providers

## [0.4.0] - 2025-09-15

### Added
- Ollama provider support for local LLM inference (`--provider ollama`)
- LMStudio provider support with OpenAI-compatible API (`--provider lmstudio`)
- `--base-url` flag to configure a custom endpoint for local LLM providers
- `--model` flag to specify the model for local LLM providers

### Changed
- AI prompts now extract person names from document content and include them at the start of the filename
- Folder name hints are filtered to ignore common irrelevant names (e.g., "no", "temp", "downloads")
- Centralized all AI prompt logic into `src/utils/ai-prompts.ts` for consistency across providers

## [0.3.1] - 2025-09-05

### Security
- Replaced vulnerable `xlsx` package with `exceljs` for Excel file parsing

### Changed
- Updated CI pipelines to test against Node.js 20, 22, and 24

## [0.3.0] - 2025-09-05

### Added
- File category templates: `document`, `movie`, `music`, `series`, `photo`, `book`, `general`, `auto`
- `-t, --template` flag to select a category template
- `-n, --name` flag to include a personal name in filenames
- `-d, --date` flag with format options: `YYYY-MM-DD`, `YYYY`, `YYYYMMDD`, `none`
- Auto-categorization based on file extension, folder path, and content keywords

## [0.2.0] - 2025-09-05

### Added
- `-c, --case` flag for naming convention: `kebab-case`, `snake_case`, `camelCase`, `PascalCase`, `lowercase`, `UPPERCASE`

## [0.1.5] - 2025-09-05

### Changed
- Progress display now updates in place on a single line with a `[current/total]` counter
- Results output changed to `original-name -> new-name` format for clarity

## [0.1.4] - 2025-09-05

### Fixed
- Console output was printing literal `\n` instead of newlines

## [0.1.3] - 2025-09-05

### Changed
- Renamed package from `ai-rename` to `namewise`
- Renamed CLI binary from `ai-rename` to `namewise`

## [0.1.1] - 2025-09-05

### Changed
- Renamed package from `smart-rename` to `ai-rename` (original name was taken on npm)
- Renamed CLI binary from `smart-rename` to `ai-rename`

## [0.1.0] - 2025-09-05

### Added
- Initial release
- AI-powered file renaming using Claude or OpenAI
- Support for PDF, DOCX, DOC, XLSX, XLS, TXT, MD, and RTF files
- Dry-run mode to preview changes without renaming
- File conflict detection
- Configurable file size limit
- Interactive API key prompt when no key is set in the environment
