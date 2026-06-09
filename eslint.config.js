import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // CLI tool: interfaces accept broad option bags; explicit any is a
      // deliberate escape hatch, unused args prefixed with _ are intentional
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
      ]
    }
  },
  {
    files: ['tests/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // mocks legitimately wrap arbitrary callbacks
      '@typescript-eslint/no-unsafe-function-type': 'off'
    }
  }
);
