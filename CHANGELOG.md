# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-04-08

### Added
- `namewise sanitize [dir]` — clean filenames without AI: strips unsafe characters, normalises unicode (NFC), and applies any naming convention; supports `--dry-run` and `--recursive`
- `namewise dedup [dir]` — find duplicate files by SHA-256 content hash; prints file paths and sizes per group, keeps the lexicographically earliest path; `--delete` prompts for confirmation before removing duplicates; supports `--recursive`
- `namewise watch [dir]` — monitor a directory for new files and automatically rename them through the full rename pipeline; accepts all `rename` flags (`--provider`, `--no-ai`, `--pattern`, etc.); shuts down gracefully on SIGINT/SIGTERM; requires `chokidar`
- `namewise apply <plan.json>` — execute a saved rename plan produced by `--output`; validates that source files exist and targets are conflict-free before applying; supports `--dry-run`
- `namewise config <list|get|set>` — manage `~/.namewise.json` from the CLI without editing JSON manually; validates keys against the known config schema
- `rename --pattern <pattern>` — regex find-and-replace on filename stems, chainable; supports sed-style `s/find/replace/flags` and plain `find:replace` format; skips AI entirely when used
- `rename --no-ai` — rename files using extracted metadata (title, author, creation date) with no API call; parsers still run; all templates and naming conventions still apply
- `undo --all` — undo all non-dry-run history sessions at once; prompts for confirmation when more than one session is affected
- Enhanced rename stats: elapsed time, total MB processed, and per-extension file count breakdown printed at the end of every `rename` run
- `namewise stats [dir]` — show total file count and storage breakdown by file type, with largest-files list; supports `--recursive`
- `namewise tree [dir]` — print visual directory tree with per-file sizes and per-folder file counts; `--depth <n>` limits recursion depth
- `namewise info <path>` — display detailed metadata for a file (size, extension, SHA-256 hash, created/modified dates) or directory (total file count, subdirectory count, total size)
- `namewise organize [dir]` — move files into subfolders organised by extension (`--by ext`), modification date (`--by date`), or file size (`--by size`); supports `--dry-run` and `--recursive`; tracks moves in history for undo
- `namewise flatten [dir]` — move all files from nested subdirectories up to the root directory; auto-resolves name conflicts with `-1`, `-2` suffixes; supports `--dry-run`; tracks moves in history
- `namewise clean-empty [dir]` — recursively find and remove empty directories; supports `--dry-run`
- `namewise find [dir]` — search files by extension (`--ext`), name glob (`--name`), size range (`--larger-than` / `--smaller-than`), or date range (`--newer-than` / `--older-than`); reports match count
- `namewise diff <dir1> <dir2>` — compare two directories by filename (`--by name`) or content hash (`--by hash`); hash mode detects moved/renamed files; reports difference count
- Batch rename flags on `rename` (no AI required): `--sequence` (sequential numbering), `--sequence-prefix <p>`, `--prefix <text>`, `--suffix <text>`, `--date-stamp created|modified`, `--strip <pattern>`, `--truncate <n>`
- `namewise init` — interactive first-time setup wizard; prompts for scope (global or project), provider, API key, base URL for local LLMs, model, naming convention, dry-run default, and personal name; writes to `~/.namewise.json` or `./.namewise.json`; detects and offers to overwrite existing config
- `apiKey` and `dryRun` fields added to the config file schema (`~/.namewise.json`); `namewise config get/set` now supports both keys; `rename` reads `apiKey` and `dryRun` from config so no flags are needed after `namewise init`
- Shared `collectFiles` utility (`src/utils/fs-collect.ts`) extracted from duplicated code in `dedup` and `sanitize`

### Changed
- `undo` now accepts `--all` flag in addition to an optional session ID
- `rename` now reads `apiKey` and `dryRun` from the config file (set by `namewise init`), so cloud API keys no longer need to be passed on every run

## [0.6.2] - 2026-04-02

### Fixed
- `ClaudeService` and `OpenAIService` now explicitly strip Windows-illegal filename characters (`< > : " / \ | ? *`) before applying the naming convention, making all four AI providers consistent; previously these characters were silently removed by `applyNamingConvention` but the sanitisation intent was invisible
- Added `stripWindowsIllegalChars` shared utility in `naming-conventions.ts` used by Claude and OpenAI services (Ollama and LMStudio already handled these inline)

### Changed
- CI test matrix now runs on `ubuntu-latest`, `windows-latest`, and `macos-latest` across Node.js 20, 22, and 24 (9 jobs total); coverage upload is gated to the ubuntu/Node 24 job only

### Tests
- Added unit tests for `stripWindowsIllegalChars` covering all 9 illegal characters and real-world AI response patterns
- Added Windows-illegal character sanitisation tests for all four AI services (`ClaudeService`, `OpenAIService`, `OllamaService`, `LMStudioService`)
- Added cross-platform `birthtime` test documenting that `FileInfo.createdAt` is correctly populated when `stat.birthtime === stat.mtime` (Linux filesystem behaviour where creation time is not stored)

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
