# Namewise

[![Tests](https://img.shields.io/badge/tests-65%20passing-brightgreen.svg)](#-testing--development)
[![Coverage](https://img.shields.io/badge/coverage-90%25%20branches-brightgreen.svg)](#-testing--development)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

🤖 **AI-Powered File Renaming CLI Tool**

Automatically rename files based on their content using Claude or OpenAI. Transform messy filenames like `document1.pdf` or `IMG_20240315_143022.pdf` into descriptive names like `project-requirements-document.pdf` or `quarterly-sales-report-q4-2023.pdf`.

> **Perfect for**: Document management, file organization, bulk renaming based on content analysis

## Features

- **AI-Powered Renaming**: Uses Claude or OpenAI to generate descriptive filenames based on document content
- **Multiple File Types**: Supports PDF, DOCX, DOC, XLSX, XLS, TXT, MD, and RTF files
- **Dry Run Mode**: Preview changes before renaming files
- **Conflict Detection**: Prevents overwriting existing files
- **Size Limits**: Configurable maximum file size limits

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/amirdaraee/namewise.git
cd namewise
npm install
npm run build

# Rename files (dry run first)
npx namewise rename ./my-documents --dry-run --provider claude

# Actually rename with your API key
npx namewise rename ./my-documents --provider claude --api-key your-api-key
```

## 📦 Installation

### Option 1: Clone and Build
```bash
git clone https://github.com/amirdaraee/namewise.git
cd namewise
npm install
npm run build
npm link  # Optional: for global usage
```

### Option 2: Direct Download
Download the latest release from [GitHub Releases](https://github.com/amirdaraee/namewise/releases)

## 📖 Usage

### Command Structure
```bash
namewise rename <directory> [options]
```

### Options Reference
| Option | Description | Default |
|--------|-------------|---------|
| `--provider` | AI provider (`claude` or `openai`) | `claude` |
| `--api-key` | API key for the chosen provider | Interactive prompt |
| `--dry-run` | Preview changes without renaming | `false` |
| `--max-size` | Maximum file size in MB | `10` |

### 💡 Examples

**Preview changes (recommended first step):**
```bash
namewise rename ./documents --dry-run
```

**Rename with Claude (interactive API key):**
```bash
namewise rename ./documents --provider claude
```

**Rename with environment variable:**
```bash
export CLAUDE_API_KEY=your-key-here
namewise rename ./documents --provider claude --api-key $CLAUDE_API_KEY
```

**Process large files:**
```bash
namewise rename ./reports --max-size 50 --provider openai
```

**Before and After Example:**
```
📁 Before:
├── IMG_20240315_143022.pdf
├── document1.docx
├── Report Q4 2023 FINAL FINAL.xlsx

📁 After:
├── quarterly-financial-report-q4-2023.pdf
├── project-requirements-specification.docx
├── annual-sales-performance-summary.xlsx
```

## 📄 Supported File Types

| Type | Extensions | Parser |
|------|------------|---------|
| 📄 PDF Documents | `.pdf` | pdf-extraction |
| 📝 Microsoft Word | `.docx`, `.doc` | mammoth |
| 📊 Microsoft Excel | `.xlsx`, `.xls` | xlsx |
| 📋 Text Files | `.txt`, `.md`, `.rtf` | Native fs |

## 🔑 API Keys Setup

### Claude (Anthropic) - Recommended
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an account and generate an API key
3. Set as environment variable: `export CLAUDE_API_KEY=your-key`

### OpenAI
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)  
2. Create an API key
3. Set as environment variable: `export OPENAI_API_KEY=your-key`

> 💡 **Tip**: The tool will prompt for API keys if not provided via command line or environment variables.

## ⚙️ How It Works

```mermaid
graph LR
    A[📁 Scan Directory] --> B[📄 Parse Content]
    B --> C[🤖 AI Analysis]
    C --> D[✏️ Generate Name]
    D --> E[✅ Validate & Rename]
```

1. **📁 File Discovery**: Scans directory for supported file types
2. **📄 Content Extraction**: Uses specialized parsers to extract text content
3. **🤖 AI Processing**: Sends content to AI provider for filename suggestions
4. **✏️ Filename Generation**: Creates clean, kebab-case names
5. **✅ Safety Checks**: Validates conflicts and performs renaming

## 🛡️ Safety Features

- ✅ **Dry Run Mode**: Always preview changes first
- ✅ **File Size Limits**: Prevents processing overly large files  
- ✅ **Conflict Detection**: Won't overwrite existing files
- ✅ **Error Handling**: Graceful handling of parsing and API errors
- ✅ **Extension Preservation**: Keeps original file extensions
- ✅ **Comprehensive Testing**: 65 tests with 90%+ branch coverage

## 🧪 Testing & Development

```bash
# Development
npm run dev              # Run in development mode
npm run build           # Build TypeScript
npm start               # Run built version

# Testing  
npm test                # Run all tests
npm run test:coverage   # Coverage report
npm run test:ui         # Interactive test UI
```

The project includes comprehensive tests with 65 test cases covering all functionality except AI API calls (which are mocked).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Submit a pull request

## 📋 Requirements

- **Node.js**: 18.0.0 or higher
- **TypeScript**: 5.0.0 or higher  
- **API Key**: Claude (Anthropic) or OpenAI

## 🐛 Troubleshooting

<details>
<summary>Common Issues</summary>

**PDF parsing errors:**
- Ensure PDF is not password protected
- Check file is not corrupted
- Try reducing max-size limit

**API errors:**
- Verify API key is valid
- Check internet connection
- Ensure sufficient API credits

**Permission errors:**
- Check file permissions
- Run with appropriate user privileges
- Ensure files aren't in use by other applications

</details>

## 📝 License

[MIT License](./LICENSE) - Feel free to use, modify, and distribute this project.

---

<div align="center">
<strong>⭐ Star this repo if it helped you organize your files! ⭐</strong>

[Report Bug](https://github.com/amirdaraee/namewise/issues) • [Request Feature](https://github.com/amirdaraee/namewise/issues)
</div>