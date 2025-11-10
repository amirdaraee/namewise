# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2025-11-10

### Added
- **📄 Scanned PDF Support**: Full support for image-only (scanned) PDFs with vision AI
  - Automatic detection of scanned PDFs (documents with minimal or no text)
  - Converts first page to image and sends to AI for content analysis
  - Intelligent image optimization to stay under Claude's 5MB limit
  - Progressive JPEG compression with multiple quality levels (0.85 → 0.3)
  - Automatic dimension scaling if needed (100% → 70% → 50%)
  - Smart size calculation to ensure API compatibility

### Enhanced
- **🔄 PDF Processing**: Replaced PDF.js with pdf-to-png-converter for better Node.js compatibility
  - Resolves canvas rendering issues in Node.js environment
  - More reliable PDF-to-image conversion
  - Better error handling and debugging
- **🤖 AI Model**: Updated to Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
  - Latest Claude model with enhanced vision capabilities
  - Improved accuracy for document analysis
  - Better understanding of complex document layouts

### Technical
- Replaced `pdfjs-dist` with `pdf-to-png-converter` package
- Enhanced PDFToImageConverter with size optimization algorithms
- Added comprehensive test suite for PDF-to-image conversion (12 new tests)
- Improved error logging with detailed stack traces

### Fixed
- **🐛 Critical**: Fixed "Image or Canvas expected" errors when processing scanned PDFs
- **🐛 Critical**: Fixed "image exceeds 5 MB maximum" errors with large scanned documents
- **🐛 Model**: Fixed deprecated model warnings by updating to latest Claude API

### Examples
```bash
# Process directory with scanned PDFs
namewise rename ./documents --dry-run

# Scanned PDFs are automatically detected and processed:
# Input:  Iran-criminal-record-2.pdf (scanned, no text)
# Output: iran-criminal-record-certificate.pdf
#
# Input:  Luxembourg-identity-2025.pdf (scanned, 14.7MB image)
# Output: luxembourg-identity-card-2025.pdf (optimized to <5MB)
```

## [0.4.1] - 2025-09-15

### Enhanced
- **🔧 Reliability Improvements**: Enhanced stability and consistency across all AI providers
- **📋 Documentation**: Improved examples and usage documentation

## [0.4.0] - 2025-09-15

### Added
- **🤖 Local LLM Provider Support**: Full integration with local AI services
  - **Ollama**: Local LLM support with customizable models (llama3.1, codellama, etc.)
  - **LMStudio**: Local model hosting with OpenAI-compatible API
  - Support for custom base URLs and model selection
  - Availability checking and model listing for local providers

### Enhanced
- **🎯 Intelligent Person Name Detection**: Major AI prompting improvements
  - AI now extracts person names from document content and places them at filename beginning
  - Smart folder name filtering to ignore irrelevant names like "no", "temp", "downloads"
  - Enhanced prompts that focus on document content rather than metadata
  - Support for detecting visa applications, contracts, medical records, certificates

### Architecture
- **📋 Centralized Prompt System**: Single source of truth for all AI prompts
  - Model-agnostic prompting that works across Claude, OpenAI, LMStudio, and Ollama
  - Consolidated prompt building in `/src/utils/ai-prompts.ts`
  - Consistent behavior across all AI providers
  - Easier maintenance and updates

### Examples
```bash
# Use local Ollama service
namewise rename ./documents --provider ollama --dry-run

# Use LMStudio with custom model
namewise rename ./files --provider lmstudio --base-url http://localhost:1234 --model codellama

# Enhanced person name detection (Sarah example)
# Input: visitor-visa-application-for-family-in-canada.pdf (in folder "no")
# Output: sarah-visitor-visa-application-for-family-members-in-canada.pdf
```

### Technical
- Enhanced CLI with new provider options and base URL configuration
- Added availability checking and model discovery for local providers

## [0.3.1] - 2025-09-05

### Security
- **🔒 Vulnerability Fix**: Replaced vulnerable `xlsx` package with secure `exceljs`
- Enhanced Excel file parsing with improved security and reliability

### Infrastructure
- **⚙️ CI/CD Improvements**: Enhanced GitHub Actions workflows
- Updated Node.js versions in CI pipelines
- Improved test workflow reliability and build process

## [0.3.0] - 2025-09-05

### Added
- **🎯 Personal File Templates**: Customizable templates for different file categories
  - `document`: Personal docs with name and date (e.g., `driving-license-amirhossein-20250213.pdf`)
  - `movie`: Movies with release year (e.g., `the-dark-knight-2008.mkv`)
  - `music`: Music with artist names (e.g., `the-beatles-hey-jude.mp3`)
  - `series`: TV series with season/episode (e.g., `breaking-bad-s01e01.mkv`)
  - `photo`: Photos with personal info (e.g., `vacation-paris-john-20240715.jpg`)
  - `book`: Books with author names (e.g., `george-orwell-1984.pdf`)
  - `general`: General files without special formatting
- **🤖 Smart File Categorization**: Automatically detects file type based on extension and content
- **👤 Personal Name Integration**: `-n, --name` option to include your name in documents
- **📅 Flexible Date Formats**: `-d, --date` option with formats:
  - `YYYY-MM-DD`: 2025-09-05
  - `YYYY`: 2025
  - `YYYYMMDD`: 20250905
  - `none`: No date (default)
- **📂 Category Templates**: `-t, --template` option to specify file category or use auto-detection

### Enhanced
- AI prompts now include category-specific instructions for better filename generation
- File processing pipeline includes template application after AI generation
- Comprehensive test coverage with 131 tests (23 new tests for templates)

### Examples
```bash
# Personal documents with your name and date
namewise rename ./documents -t document -n "amirhossein" -d "YYYYMMDD" --dry-run
# Result: driving-license-amirhossein-20250905.pdf

# Movies with auto-detection
namewise rename ./movies --dry-run
# Result: the-dark-knight-2008.mkv

# Series with season/episode detection
namewise rename ./shows --dry-run  
# Result: breaking-bad-s01e01.mkv

# Music with artist names
namewise rename ./music -t music --dry-run
# Result: the-beatles-hey-jude.mp3
```

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