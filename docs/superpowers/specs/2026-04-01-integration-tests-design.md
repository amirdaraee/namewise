# Integration Tests Design

**Date:** 2026-04-01
**Status:** Approved

## Overview

Full overhaul of the integration test suite for Namewise. Fix all existing broken/placeholder tests, add a shared test harness, add new test data files, and add two new integration test files. All integration tests use real parsers and real I/O — only the AI service is mocked.

---

## Goals

- Replace placeholder `expect(true).toBe(true)` tests with real assertions
- Fix type bugs (`provider` → `aiProvider`, missing `accessedAt` on `FileInfo`)
- Ensure every parser type (txt, md, pdf, docx, xlsx) has integration coverage
- Verify CLI flag combinations against the built binary
- Establish a shared harness that makes future integration tests easy to write

## Non-Goals

- Testing real AI providers (no API calls)
- Performance or load testing
- Testing the OCR/scanned-PDF path (covered by unit tests)

---

## Architecture

### Shared Harness (`tests/integration/helpers/harness.ts`)

Provides utilities used by all integration test files:

- **`createTempDir()`** — creates a real temp directory under `os.tmpdir()`, returns `{ dir: string, cleanup: () => Promise<void> }`
- **`copyTestFile(src, destDir)`** — copies a file from `tests/data/` into the temp dir, returns the new path
- **`MockAIService`** — implements `AIProvider`; supports content-keyed responses, call capture, failure injection, call count tracking. Replaces `tests/mocks/mock-ai-service.ts`.
- **`makeConfig(overrides?)`** — returns a valid `Config` with sensible defaults, partially overridable
- **`makeFileInfo(overrides?)`** — returns a valid `FileInfo` including all required fields (`accessedAt`, `parentFolder`, `folderPath`)

The old `tests/mocks/mock-ai-service.ts` is deleted; all imports redirected to the harness.

---

## Test Data Files

### Existing (kept as-is)
- `sample-text.txt`
- `sample-markdown.md`
- `sample-pdf.pdf`
- `empty-file.txt`
- Various display-test `.txt` files

### New
| File | Content | Purpose |
|------|---------|---------|
| `contract-john-doe.txt` | Employment contract mentioning "John Doe" | Person name extraction |
| `visa-application-setareh.txt` | Visa application mentioning "Setareh Ahmadi" | Person name + folder filtering |
| `quarterly-report.md` | Markdown business report | MD parser + auto-categorization |
| `meeting-notes.txt` | Meeting notes with attendees list | General content → filename |
| `sample-document.docx` | Minimal Word document | DOCX real parser I/O |
| `sample-spreadsheet.xlsx` | Minimal Excel spreadsheet | XLSX real parser I/O |

---

## Integration Test Files

### File Structure
```
tests/
  data/
    (existing files)
    contract-john-doe.txt
    visa-application-setareh.txt
    quarterly-report.md
    meeting-notes.txt
    sample-document.docx
    sample-spreadsheet.xlsx
  integration/
    helpers/
      harness.ts
    workflow.test.ts            ← rewritten
    ai-prompting.test.ts        ← rewritten
    person-name-extraction.test.ts ← rewritten
    end-to-end.test.ts          ← rewritten
    parser-pipeline.test.ts     ← new
    cli-flags.test.ts           ← new
  mocks/
    mock-ai-service.ts          ← deleted
```

### `workflow.test.ts` (rewritten)
Uses real parsers on real test data files in a temp dir. No mocked `fs`, no mocked parser factory.

Tests:
- Full pipeline on `.txt` file with dry-run → no fs.rename, AI still called
- Full pipeline on `.md` file with actual rename in temp dir
- Mixed success/failure: normal file + oversized file + empty file
- File conflict detection (two files that would map to the same name)
- AI failure → graceful error result, pipeline continues for other files
- All 6 naming conventions produce correctly cased output
- `general` vs `document` template produces different filename shapes

### `ai-prompting.test.ts` (rewritten)
Real parsers + harness `MockAIService` with call capture. Fixes `provider` → `aiProvider`.

Tests:
- `namingConvention` is passed correctly to AI for each convention type
- `category` passed correctly for each template category
- `documentMetadata` (title, author, pages) is populated and passed after parsing
- `parentFolder` and `folderPath` are present in `fileInfo` passed to AI
- `fileInfo.size` matches the actual file size

### `person-name-extraction.test.ts` (rewritten)
Uses real test data files (`contract-john-doe.txt`, `visa-application-setareh.txt`). Fixes type bugs.

Tests:
- Visa application content → person name appears at start of suggested filename
- Employment contract content → person name extracted correctly
- Irrelevant folder names (`no`, `temp`, `downloads`, `misc`) do not appear in output
- Meaningful folder names are passed as context to AI
- Content without clear person names → falls back to generic document name
- `#NO` special-character folder name is filtered

### `end-to-end.test.ts` (rewritten)
Removes all placeholder tests. Keeps CLI binary tests. Scope is limited to tests that do **not** require an AI service call (help, version, flag validation, error paths) — the full rename workflow via CLI is out of scope since it would need a live API key or local model. That workflow is covered programmatically in `workflow.test.ts`.

Tests:
- `--help` contains expected sections
- `rename --help` lists all flags and their options
- `--version` matches semver format
- Error on non-existent directory (exits with non-zero code, stderr contains "Error:")
- Error on missing API key for `--provider claude` (non-zero exit, meaningful message)

### `parser-pipeline.test.ts` (new)
One test per parser type. Each test: copy real file to temp dir, parse it, verify content + metadata, then run through `FileRenamer` with mocked AI.

Tests:
- `.txt` → content is non-empty string, flows into `FileRenamer` successfully
- `.md` → content is non-empty, markdown syntax stripped or preserved correctly
- `.pdf` → content extracted from `sample-pdf.pdf`, non-empty
- `.docx` → content from `sample-document.docx`, `documentMetadata.title` populated
- `.xlsx` → content from `sample-spreadsheet.xlsx`, cell data present in extracted text
- Unsupported extension (`.xyz`) → `FileRenamer` returns error result, no AI call

### `cli-flags.test.ts` (new)
Exhaustive CLI flag tests using the built binary. Skips if `dist/index.js` not found.

Tests:
- All 6 `--case` values appear in rename help
- All template categories appear in rename help
- All date format options appear in rename help
- `--max-size` flag accepted and shown in help
- `--dry-run` flag accepted
- `--provider` accepts `claude`, `openai`, `ollama`, `lmstudio`
- Invalid `--provider` value → error message
- Invalid `--case` value → error message

---

## Key Design Decisions

1. **No mocked `fs`** — all file I/O is real, via harness temp dirs. Tests are slower but more trustworthy.
2. **Harness `MockAIService`** absorbs `tests/mocks/mock-ai-service.ts` — single source of truth for the mock.
3. **CLI tests use `test.skipIf(!existsSync(cliPath))`** — build requirement is explicit, not silent.
4. **All `FileInfo` objects via `makeFileInfo()`** — ensures `accessedAt` and other required fields are always present.
5. **Test data files created programmatically** where possible (docx/xlsx via their respective libraries in a setup script or fixture), avoiding binary blobs in git where feasible.

---

## Success Criteria

- `npm run test:integration` passes with 0 placeholder assertions
- Every parser type has at least one integration test that reads a real file
- CLI flag tests cover all options documented in `--help`
- No test directly mocks `fs.rename`, `fs.access`, or `DocumentParserFactory`
- Coverage remains at or above current levels
