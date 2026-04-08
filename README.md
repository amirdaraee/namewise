# Namewise

[![Tests](https://img.shields.io/badge/tests-778%20passing-brightgreen.svg)](#testing--development)
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
- **No-AI Mode**: Rename using file metadata only — no API key required (`--no-ai`)
- **Interactive Setup**: First-time wizard to configure provider, API key, naming convention and more (`namewise init`)
- **Batch Rename (no AI)**: Sequence-number, prefix/suffix, date-stamp, strip, or truncate filenames in bulk (`--sequence`, `--prefix`, `--suffix`, `--date-stamp`, `--strip`, `--truncate`)
- **Pattern Rename**: Regex/sed-style find-and-replace on filenames, chainable, no AI needed (`--pattern`)
- **Watch Mode**: Monitor a directory and auto-rename new files as they arrive (`namewise watch`)
- **Sanitize**: Clean filenames by removing unsafe characters and applying naming conventions (`namewise sanitize`)
- **Dedup**: Find and optionally delete duplicate files by content hash (`namewise dedup`)
- **Apply Plans**: Execute a saved rename plan from a previous `--output` report (`namewise apply`)
- **Config Management**: Manage `~/.namewise.json` from the CLI (`namewise config get|set|list`)
- **Storage Stats**: Show file count and size breakdown by type (`namewise stats`)
- **Tree View**: Visual directory tree with file sizes and per-folder summaries (`namewise tree`)
- **File Info**: Detailed metadata for any file or directory including SHA-256 hash (`namewise info`)
- **Organize**: Move files into subfolders by extension, date, or size (`namewise organize`)
- **Flatten**: Move all nested files up to the root directory (`namewise flatten`)
- **Clean Empty Dirs**: Find and remove empty directories recursively (`namewise clean-empty`)
- **Find**: Search files by extension, name glob, size range, or date range (`namewise find`)
- **Diff Directories**: Compare two directories by filename or content hash (`namewise diff`)
- **Recursive Scanning**: Scan nested directories with an optional depth limit
- **Undo Support**: Reverse any previous rename session via `namewise undo` (or `undo --all`)
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

# Run the interactive setup wizard (recommended for first use)
namewise init

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
namewise init                               # First-time setup wizard
namewise rename [directory] [options]       # AI-powered rename (or batch rename with flags)
namewise sanitize [directory] [options]     # Clean filenames without AI
namewise dedup [directory] [options]        # Find and remove duplicate files
namewise watch [directory] [options]        # Auto-rename new files as they arrive
namewise apply <plan.json> [options]        # Execute a saved rename plan
namewise config <list|get|set> [key] [val] # Manage ~/.namewise.json
namewise undo [session-id] [options]        # Reverse a previous rename session
namewise stats [directory] [options]        # Storage breakdown by file type
namewise tree [directory] [options]         # Visual directory tree with sizes
namewise info <path>                        # Metadata for a file or directory
namewise organize [directory] [options]     # Move files into subfolders
namewise flatten [directory] [options]      # Move all nested files to root
namewise clean-empty [directory] [options]  # Remove empty directories
namewise find [directory] [options]         # Search files by criteria
namewise diff <dir1> <dir2> [options]       # Compare two directories
```

### `init`

Run `namewise init` to launch the interactive setup wizard. It will ask:

| Step | Question | Notes |
|------|----------|-------|
| 1 | **Scope** — global (`~/.namewise.json`) or project (`./.namewise.json`) | Global applies everywhere |
| 2 | **AI provider** — claude, openai, ollama, lmstudio | |
| 3 | **API key** | Cloud providers only; stored in config file |
| 4 | **Base URL** | Local providers only; skipped if using the default |
| 5 | **Model** | Leave blank to use the provider default |
| 6 | **Naming convention** | kebab-case, snake_case, camelCase, etc. |
| 7 | **Output language** | e.g. `English`, `French` — leave blank to match document language |
| 8 | **Always dry-run by default?** | Recommended `Yes` for first-time users |
| 9 | **Your name** | Optional; used in document/photo templates |

After init, all saved settings apply automatically — no flags needed on every run.

### `rename` Options

| Option | Description | Default |
|--------|-------------|---------|
| `--provider` | AI provider (`claude`, `openai`, `ollama`, `lmstudio`) | `claude` |
| `--base-url` | Base URL for local LLM providers | Auto-detected |
| `--model` | Model name (overrides provider default for any provider) | Provider default |
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
| `--pattern <pattern>` | Regex rename pattern (repeatable); skips AI | - |
| `--no-ai` | Use file metadata instead of AI (no API call) | `false` |
| `--language <lang>` | Output language for generated filenames (e.g. `English`, `French`) | Document language |

### `sanitize` Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Preview changes without renaming | `false` |
| `-r, --recursive` | Process subdirectories | `false` |
| `--case` | Naming convention to apply | `kebab-case` |

### `dedup` Options

| Option | Description | Default |
|--------|-------------|---------|
| `-r, --recursive` | Scan subdirectories | `false` |
| `--delete` | Delete duplicates after confirmation | `false` |

### `undo` Options

| Option | Description |
|--------|-------------|
| `--list` | List recent rename sessions with their IDs |
| `--all` | Undo all sessions at once |
| `[session-id]` | Undo a specific session by ID (default: most recent) |

### Batch rename flags (on `rename`, no AI required)

| Flag | Description | Example |
|------|-------------|---------|
| `--sequence` | Replace filenames with padded sequence numbers | `001.pdf`, `002.pdf` |
| `--sequence-prefix <p>` | Prefix for sequence numbers | `--sequence-prefix photo` → `photo-001.jpg` |
| `--prefix <text>` | Prepend text to every filename stem | `--prefix "2024-"` |
| `--suffix <text>` | Append text to every filename stem | `--suffix "-final"` |
| `--date-stamp <created\|modified>` | Prepend file date to stem | `--date-stamp modified` |
| `--strip <pattern>` | Remove a substring or regex from stems | `--strip "IMG_"` |
| `--truncate <n>` | Truncate stems to N characters | `--truncate 20` |

### `stats` Options

| Option | Description | Default |
|--------|-------------|---------|
| `-r, --recursive` | Include subdirectories | `false` |

### `tree` Options

| Option | Description | Default |
|--------|-------------|---------|
| `--depth <n>` | Maximum depth to display | Unlimited |

### `organize` Options

| Option | Description | Default |
|--------|-------------|---------|
| `--by <mode>` | Organisation mode: `ext` \| `date` \| `size` | `ext` |
| `-r, --recursive` | Include subdirectories | `false` |
| `--dry-run` | Preview without moving files | `false` |

### `flatten` Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Preview without moving files | `false` |

### `clean-empty` Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Preview without deleting directories | `false` |

### `find` Options

| Option | Description |
|--------|-------------|
| `--ext <ext>` | Filter by file extension (e.g. `pdf`) |
| `--name <glob>` | Filter by filename glob (e.g. `"*.report*"`) |
| `--larger-than <size>` | Minimum size (e.g. `5mb`, `100kb`, `500`) |
| `--smaller-than <size>` | Maximum size (e.g. `10mb`) |
| `--newer-than <date>` | Modified after date (`YYYY-MM-DD`) |
| `--older-than <date>` | Modified before date (`YYYY-MM-DD`) |
| `-r, --recursive` | Search subdirectories (default: `true`) |

### `diff` Options

| Option | Description | Default |
|--------|-------------|---------|
| `--by <mode>` | Compare by `name` or `hash` (content-aware, detects renames) | `name` |
| `-r, --recursive` | Compare subdirectories | `true` |

### Examples

**First-time setup:**
```bash
namewise init
# Walks through provider, API key, naming convention, dry-run preference, and your name
# Saves to ~/.namewise.json or ./.namewise.json
```

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

**Rename using metadata only (no API key needed):**
```bash
namewise rename ./documents --no-ai --dry-run
```

**Force output language (e.g. rename Farsi documents with English names):**
```bash
namewise rename ./farsi-docs --language English --dry-run
namewise rename ./documents --language French
```

**Regex pattern rename (no AI):**
```bash
namewise rename ./docs --pattern "s/IMG_//i" --pattern "s/ /-/g" --dry-run
```

**Clean filenames without AI:**
```bash
namewise sanitize ./downloads --dry-run
namewise sanitize ./downloads --case snake_case
```

**Find and remove duplicate files:**
```bash
namewise dedup ./photos --recursive
namewise dedup ./photos --recursive --delete
```

**Watch a directory and auto-rename new files:**
```bash
namewise watch ./inbox --provider claude --template document
namewise watch ./inbox --no-ai --case snake_case
```

**Apply a saved rename plan:**
```bash
namewise rename ./docs --output ./plan.json --dry-run
namewise apply ./plan.json
```

**Manage config from the CLI:**
```bash
namewise config list
namewise config get provider
namewise config set case snake_case
```

**Undo the last rename session:**
```bash
namewise undo
namewise undo --all
```

**List and undo a specific session:**
```bash
namewise undo --list
namewise undo 2026-04-02T10:30:00.000Z
```

**Batch rename without AI:**
```bash
namewise rename ./photos --sequence --sequence-prefix holiday
# holiday-001.jpg, holiday-002.jpg, ...

namewise rename ./docs --prefix "2024-" --dry-run
namewise rename ./exports --suffix "-final" --truncate 30
namewise rename ./downloads --strip "IMG_" --date-stamp modified
```

**Storage stats:**
```bash
namewise stats ./documents
namewise stats ./projects --recursive
```

**Directory tree:**
```bash
namewise tree ./src
namewise tree ./src --depth 3
```

**File or directory info:**
```bash
namewise info ./report.pdf
namewise info ./downloads
```

**Organise files into subfolders:**
```bash
namewise organize ./downloads --by ext --dry-run
namewise organize ./photos --by date
namewise organize ./backup --by size --dry-run
```

**Flatten nested directories:**
```bash
namewise flatten ./inbox --dry-run
namewise flatten ./inbox
```

**Remove empty directories:**
```bash
namewise clean-empty ./projects --dry-run
namewise clean-empty ./projects
```

**Find files by criteria:**
```bash
namewise find ./downloads --ext pdf
namewise find ./photos --larger-than 5mb --newer-than 2024-01-01
namewise find . --name "*.report*" --smaller-than 1mb
```

**Compare two directories:**
```bash
namewise diff ./backup ./original
namewise diff ./backup ./original --by hash   # detects renamed files
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

Supported keys: `provider`, `apiKey`, `case`, `template`, `name`, `date`, `maxSize`, `model`, `baseUrl`, `concurrency`, `recursive`, `depth`, `output`, `dryRun`, `language`.

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
| `movie` | AI provides full name | `the-dark-knight-2008.mkv` | Movie files — AI includes release year |
| `series` | AI provides full name | `breaking-bad-s01e01.mkv` | TV series — AI includes season/episode |
| `music` | AI provides full name | `the-beatles-hey-jude.mp3` | Music files — AI includes artist name |
| `photo` | `{content}-{name}-{date}` | `vacation-paris-john-20240715.jpg` | Personal photos |
| `book` | AI provides full name | `george-orwell-1984.pdf` | Books — AI includes author name |
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
4. Default model: `claude-sonnet-4-5-20250929` (override with `--model`)

**OpenAI**
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create an API key
3. `export OPENAI_API_KEY=your-key`
4. Default model: `gpt-4o` (override with `--model`)

## How It Works

1. **File Discovery**: Scans directory (recursively if `--recursive`) for supported file types
2. **Content Extraction**: Uses specialized parsers to extract text and metadata; falls back to vision AI for scanned PDFs
3. **AI Processing**: Sends up to 5000 characters of content plus metadata to the configured AI provider for filename suggestions
4. **Template & Convention**: Applies the chosen category template and naming convention; for `document` and `photo` templates, uses the document's own creation date from metadata when available
5. **Conflict Resolution**: If the target name exists, auto-numbers (`-2`, `-3`, …)
6. **Rename / Preview**: Renames files on disk, or shows a preview in dry-run mode
7. **History**: Saves the session to `~/.namewise/history.json` for later undo

## Safety Features

- **Dry Run Mode**: Always preview changes first with `--dry-run`
- **Undo**: Reverse any session with `namewise undo` (or `undo --all`)
- **Conflict Auto-Numbering**: Never overwrites an existing file
- **File Size Limits**: Skips files above `--max-size`
- **Extension Preservation**: Original file extensions are never changed
- **Comprehensive Testing**: 621 tests with 100% coverage

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
