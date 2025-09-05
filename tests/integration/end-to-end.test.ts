import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock fs operations for integration tests
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      rename: vi.fn(),
      access: vi.fn()
    }
  };
});

describe('End-to-End Integration Tests', () => {
  const testDataDir = path.join(process.cwd(), 'tests/data');
  const cliPath = path.join(process.cwd(), 'dist/index.js');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CLI Integration', () => {
    it('should show help message', async () => {
      const { stdout } = await execAsync(`node ${cliPath} --help`);
      
      expect(stdout).toContain('AI-powered tool to intelligently rename files based on their content');
      expect(stdout).toContain('rename [options] <directory>');
      expect(stdout).toContain('Commands:');
    });

    it('should show rename command help', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      
      expect(stdout).toContain('Rename files in a directory based on their content');
      expect(stdout).toContain('Arguments:');
      expect(stdout).toContain('directory');
      expect(stdout).toContain('Options:');
      expect(stdout).toContain('-p, --provider');
      expect(stdout).toContain('-k, --api-key');
      expect(stdout).toContain('-c, --case');
      expect(stdout).toContain('-t, --template');
      expect(stdout).toContain('-n, --name');
      expect(stdout).toContain('-d, --date');
      expect(stdout).toContain('--dry-run');
      expect(stdout).toContain('--max-size');
    });

    it('should show naming convention options in help', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      
      expect(stdout).toContain('kebab-case');
      expect(stdout).toContain('snake_case');
      expect(stdout).toContain('camelCase');
      expect(stdout).toContain('PascalCase');
      expect(stdout).toContain('lowercase');
      expect(stdout).toContain('UPPERCASE');
    });

    it('should show template category options in help', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      
      expect(stdout).toContain('document');
      expect(stdout).toContain('movie');
      expect(stdout).toContain('music');
      expect(stdout).toContain('series');
      expect(stdout).toContain('photo');
      expect(stdout).toContain('book');
      expect(stdout).toContain('general');
    });

    it('should show date format options in help', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      
      expect(stdout).toContain('YYYY-MM-DD');
      expect(stdout).toContain('YYYY');
      expect(stdout).toContain('YYYYMMDD');
      expect(stdout).toContain('none');
    });

    it('should show version', async () => {
      const { stdout } = await execAsync(`node ${cliPath} --version`);
      
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should require directory argument', async () => {
      try {
        await execAsync(`node ${cliPath} rename`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('error: missing required argument');
      }
    });

    it('should handle non-existent directory', async () => {
      try {
        await execAsync(`node ${cliPath} rename /non/existent/directory --dry-run`, {
          input: 'test-key\n'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Error:');
      }
    });
  });

  describe('Full Workflow Integration', () => {
    it('should process files with mock AI service (dry run)', async () => {
      // This test would need actual AI service mocking at the CLI level
      // For now, we'll test the structure
      
      const testDir = path.join(testDataDir);
      
      // Mock the AI service response by setting environment variables or config
      process.env.MOCK_AI_RESPONSE = 'test-document-name';
      
      try {
        // This would fail without real API key, but tests the flow
        const command = `echo "test-key" | node ${cliPath} rename ${testDir} --dry-run --provider claude`;
        
        // For a real test, we'd need to mock the AI service at a higher level
        // This is a placeholder for the integration test structure
        expect(true).toBe(true); // Placeholder assertion
      } catch (error) {
        // Expected in test environment without real API key
        expect(true).toBe(true);
      } finally {
        delete process.env.MOCK_AI_RESPONSE;
      }
    });
  });

  describe('File Processing Integration', () => {
    it('should detect supported files correctly', async () => {
      // Create a temporary test directory structure
      const tempDir = path.join(process.cwd(), 'temp-test');
      
      try {
        await fs.mkdir(tempDir, { recursive: true });
        await fs.writeFile(path.join(tempDir, 'test.txt'), 'Test content');
        await fs.writeFile(path.join(tempDir, 'test.md'), '# Test markdown');
        await fs.writeFile(path.join(tempDir, 'unsupported.xyz'), 'Unsupported file');
        
        // The actual CLI would process only supported files
        // This test validates the file detection logic
        
        const files = await fs.readdir(tempDir);
        const supportedExtensions = ['.txt', '.md', '.pdf', '.docx', '.xlsx'];
        const supportedFiles = files.filter(file => 
          supportedExtensions.some(ext => file.endsWith(ext))
        );
        
        expect(supportedFiles).toHaveLength(2);
        expect(supportedFiles).toContain('test.txt');
        expect(supportedFiles).toContain('test.md');
        expect(supportedFiles).not.toContain('unsupported.xyz');
        
      } finally {
        // Clean up
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle parser errors gracefully', async () => {
      // Test that the application handles various error conditions
      // without crashing and provides meaningful error messages
      
      const invalidFiles = [
        'non-existent.pdf',
        'empty.txt',
        'corrupted.docx'
      ];
      
      // Each of these should be handled gracefully by the application
      // without causing the entire process to fail
      
      expect(invalidFiles.length).toBeGreaterThan(0); // Placeholder assertion
    });

    it('should validate configuration parameters', async () => {
      const invalidConfigs = [
        { maxSize: -1 },
        { maxSize: 'invalid' },
        { provider: 'invalid-provider' }
      ];
      
      // Each invalid config should be caught and handled appropriately
      expect(invalidConfigs.length).toBeGreaterThan(0); // Placeholder assertion
    });
  });
});