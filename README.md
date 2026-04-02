# Namewise

[![Tests](https://img.shields.io/badge/tests-428%20passing-brightgreen.svg)](#testing--development)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](#testing--development)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**AI-Powered File Renaming CLI Tool**

Automatically rename files based on their content using AI providers (Claude, OpenAI, Ollama, LMStudio). Transform messy filenames like `document1.pdf` or `IMG_20240315_143022.pdf` into descriptive names like `project-requirements-document.pdf` or `quarterly-sales-report-q4-2023.pdf`.

> **Perfect for**: Document management, file organization, bulk renaming based on content analysis

## Features

- **AI-Powered Renaming**: Uses cloud providers (Claude, OpenAI) or local LLMs (Ollama, LMStudio) to generate descriptive filenames
- **Privacy First**: Local LLM support means your files never leave your machine
- **Recursive Scanning**: Scan nested directories with an optional depth limit
- **Undo Support**: Reverse any previous rename session via `namewise undo`
- **Config File**: Set persistent defaults in `~/.namewise.json` or per-project `.namewise.json`
- **Concurrency Control**: Process multiple files in parallel with a configurable limit
- **Conflict Auto-Numbering**: When a target name is taken, automatically appends `-2`, `-3`, etc.
- **JSON Report Output**: Save a full rename report to a file with `--output`
- **Personal File Templates**: Customizable templates for different file categories (documents, movies, music, series, photos, books)
- **Smart Categorization**: Automatic file type detection or manual category selection
- **Naming Convention Options**: 6 different formats (kebab-case, snake_case, camelCase, PascalCase, lowercase, UPPERCASE)
- **Multiple File Types**: Supports PDF, DOCX, DOC, XLSX, XLS, TXT, MD, and RTF files
- **Dry Run Mode**: Preview changes before renaming files
- **Size Limits**: Configurable maximum file size limits

## Quick Start

```bash
# Clone and setup
git clone https://github.com/amirdaraee/namewise.git
cd namewise
npm install
npm run build

# Preview renames (recommended first)
npx namewise rename ./my-documents --dry-run --provider claude

# Actually rename
npx namewise rename ./my-documents --provider claude --api-key your-api-key
```

## Installation

### Option 1: Clone and Build
```bash
git clone https://github.com/amirdaraee/namewise.git
cd namewise
npm install
npm run build
npm link # Optional: for global usage
```

### Option 2: Direct Download
Download the latest release from [GitHub Releases](https://github.com/amirdaraee/namewise/releases)

## Usage

### Command Structure
```bash
namewise rename [directory] [options]
namewise undo [session-id] [options]
```

### Options Reference

| Option | Description | Default |
|--------|-------------|---------|
| `--provider` | AI provider (`claude`, `openai`, `ollama`, `lmstudio`) | `claude` |
| `--base-url` | Base URL for local LLM providers | Auto-detected |
| `--model` | Model name for local LLM providers | Provider default |
| `--api-key` | API key for the chosen provider | Interactive prompt |
| `--case` | Naming convention (kebab-case, snake_case, camelCase, PascalCase, lowercase, UPPERCASE) | `kebab-case` |
| `--template` | File category template (document, movie, music, series, photo, book, general, auto) | `general` |
| `--name` | Personal name to include in filenames | - |
| `--date` | Date format (YYYY-MM-DD, YYYY, YYYYMMDD, none) | `none` |
| `--dry-run` | Preview changes without renaming | `false` |
| `--max-size` | Maximum file size in MB | `10` |
| `-r, --recursive` | Recursively scan subdirectories | `false` |
| `--depth <n>` | Maximum recursion depth (requires `--recursive`) | Unlimited |
| `--concurrency <n>` | Files to process in parallel | `3` |
| `--output <path>` | Save rename report as JSON to this path | - |

### Undo Options

| Option | Description |
|--------|-------------|
| `--list` | List recent rename sessions with their IDs |
| `[session-id]` | Undo a specific session by ID (default: most recent) |

### Examples

**Basic usage:**
```bash
namewise rename ./documents --dry-run
# Result: quarterly-financial-report.pdf
```

**Recursive scan with depth limit:**
```bash
namewise rename ./projects --recursive --depth 2 --dry-run
```

**Save a JSON report:**
```bash
namewise rename ./documents --output ./report.json
```

**Undo the last rename session:**
```bash
namewise undo
```

**List and undo a specific session:**
```bash
namewise undo --list
namewise undo 2026-04-02T10:30:00.000Z
```

**Personal documents with your name and date:**
```bash
namewise rename ./documents --template document --name "john" --date "YYYYMMDD" --dry-run
# Result: driving-license-john-20250905.pdf
```

**Movies with automatic detection:**
```bash
namewise rename ./movies --template auto --dry-run
# Result: the-dark-knight-2008.mkv
```

**TV series with season/episode detection:**
```bash
namewise rename ./shows --template auto --dry-run
# Result: breaking-bad-s01e01.mkv
```

**Snake case naming convention:**
```bash
namewise rename ./docs --case snake_case --dry-run
# Result: project_requirements_document.pdf
```

**Local LLMs (no API key required):**
```bash
# Ollama - requires 'ollama serve' running
namewise rename ./documents --provider ollama --dry-run

# LMStudio - requires local server enabled
namewise rename ./contracts --provider lmstudio --dry-run
```

**Cloud providers:**
```bash
export ANTHROPIC_API_KEY=your-key
namewise rename ./documents --provider claude --dry-run

export OPENAI_API_KEY=your-key
namewise rename ./files --provider openai --dry-run
```

**Before and after:**
```
Before:
├── IMG_20240315_143022.pdf
├── document1.docx
├── Report Q4 2023 FINAL FINAL.xlsx

After:
├── quarterly-financial-report-q4-2023.pdf
├── project-requirements-specification.docx
├── annual-sales-performance-summary.xlsx
```

## Config File

Set persistent defaults so you don't have to repeat flags on every run.

**User-wide defaults** (`~/.namewise.json`):
```json
{
  "provider": "claude",
  "case": "snake_case",
  "concurrency": 5
}
```

**Per-project overrides** (`<targetDir>/.namewise.json`):
```json
{
  "template": "document",
  "name": "alice",
  "date": "YYYYMMDD"
}
```

Priority order (highest to lowest): CLI flags > project config > user config.

Supported keys: `provider`, `case`, `template`, `name`, `date`, `maxSize`, `model`, `baseUrl`, `concurrency`, `recursive`, `depth`, `output`.

## Supported File Types

| Type | Extensions | Parser |
|------|------------|--------|
| PDF Documents | `.pdf` | pdf-extraction |
| Microsoft Word | `.docx`, `.doc` | mammoth |
| Microsoft Excel | `.xlsx`, `.xls` | exceljs |
| Text Files | `.txt`, `.md`, `.rtf` | Native fs |

## File Templates

| Template | Pattern | Example Output | When to Use |
|----------|---------|----------------|-------------|
| `general` | `{content}` | `meeting-notes-q4-2024.pdf` | Default — simple descriptive names |
| `document` | `{content}-{name}-{date}` | `driving-license-john-20250905.pdf` | Personal documents, contracts, certificates |
| `movie` | `{content}-{year}` | `the-dark-knight-2008.mkv` | Movie files with release year |
| `series` | `{content}-s{season}e{episode}` | `breaking-bad-s01e01.mkv` | TV series episodes |
| `music` | `{artist}-{content}` | `the-beatles-hey-jude.mp3` | Music files with artist |
| `photo` | `{content}-{name}-{date}` | `vacation-paris-john-20240715.jpg` | Personal photos |
| `book` | `{author}-{content}` | `george-orwell-1984.pdf` | Books and ebooks |
| `auto` | *Automatic* | *Varies by detected type* | Let AI detect and choose best template |

## AI Provider Setup

### Local LLMs (no API keys required)

**Ollama**
1. Install: Download from [ollama.ai](https://ollama.ai)
2. Start server: `ollama serve`
3. Pull a model: `ollama pull llama3.1`
4. Use: `--provider ollama`

**LMStudio**
1. Install: Download from [lmstudio.ai](https://lmstudio.ai)
2. Download and load a model in LMStudio
3. Enable "Local Server" mode
4. Use: `--provider lmstudio`

### Cloud Providers (API keys required)

**Claude (Anthropic)** — recommended for accuracy
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Generate an API key
3. `export ANTHROPIC_API_KEY=your-key`

**OpenAI**
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create an API key
3. `export OPENAI_API_KEY=your-key`

## How It Works

1. **File Discovery**: Scans directory (recursively if `--recursive`) for supported file types
2. **Content Extraction**: Uses specialized parsers to extract text; falls back to vision AI for scanned PDFs
3. **AI Processing**: Sends content to the configured AI provider for filename suggestions
4. **Template & Convention**: Applies the chosen category template and naming convention
5. **Conflict Resolution**: If the target name exists, auto-numbers (`-2`, `-3`, …)
6. **Rename / Preview**: Renames files on disk, or shows a preview in dry-run mode
7. **History**: Saves the session to `~/.namewise/history.json` for later undo

## Safety Features

- **Dry Run Mode**: Always preview changes first with `--dry-run`
- **Undo**: Reverse any session with `namewise undo`
- **Conflict Auto-Numbering**: Never overwrites an existing file
- **File Size Limits**: Skips files above `--max-size`
- **Extension Preservation**: Original file extensions are never changed
- **Comprehensive Testing**: 428 tests with 100% coverage

## Testing & Development

```bash
# Development
npm run dev          # Run in development mode
npm run build        # Build TypeScript
npm start            # Run built version

# Testing
npm test             # Run all tests (watch mode)
npm run test:run     # Run tests once
npm run test:coverage # Coverage report
npm run test:unit    # Unit tests only
npm run test:integration # Integration tests only
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Submit a pull request

## Requirements

- **Node.js**: 20.0.0 or higher
- **AI Provider**: Choose one:
  - **Local**: Ollama or LMStudio (no API key needed)
  - **Cloud**: Claude (Anthropic) or OpenAI API key

## Troubleshooting

<details>
<summary>Common Issues</summary>

**PDF parsing errors:**
- Ensure the PDF is not password protected
- Check the file is not corrupted
- Try reducing the `--max-size` limit

**API errors (cloud providers):**
- Verify the API key is valid
- Check your internet connection
- Ensure sufficient API credits

**Local LLM connection errors:**
- Ensure Ollama server is running (`ollama serve`)
- Check LMStudio local server is enabled
- Verify correct base URL and port
- Confirm the model is loaded and available

**Permission errors:**
- Check file permissions
- Run with appropriate user privileges
- Ensure files are not open in another application

</details>

## License

[MIT License](./LICENSE) — Feel free to use, modify, and distribute this project.

---

[Report Bug](https://github.com/amirdaraee/namewise/issues) • [Request Feature](https://github.com/amirdaraee/namewise/issues)
