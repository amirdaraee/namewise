---
name: new-command
description: Scaffold a new namewise CLI subcommand following the project's established pattern - implementation file in src/cli/, registration in commands.ts, and unit tests with 100% coverage. Use when adding any new subcommand to the CLI.
---

# Add a New CLI Subcommand

Namewise subcommands follow a strict three-file pattern. Follow every step; coverage thresholds fail CI if tests are skipped.

## 1. Implementation: `src/cli/<kebab-name>.ts`

- Export one async function named in camelCase (e.g. `cleanEmptyDirs` for `clean-empty`).
- Signature: `(directory: string, options: { ... } = {}): Promise<void>`.
- Use `* as ui from '../utils/ui.js'` for output (`ui.info`, `ui.success`, `ui.dim`, `ui.warn`) - never raw `console.log`.
- Validate the directory first: `const stat = await fs.stat(directory); if (!stat.isDirectory()) throw new Error(...)`.
- Support `dryRun` if the command mutates the filesystem: print `[dry-run]`-prefixed lines via `ui.dim` and skip the mutation.
- ESM project: all relative imports MUST end in `.js` even though sources are `.ts`.
- Throw `NamewiseError` (from `src/errors.ts`) for user-facing failures with guidance; plain `Error` is acceptable for simple validation.

Reference example: `src/cli/clean-empty.ts` (68 lines, the cleanest template).

## 2. Registration: `src/cli/commands.ts`

Inside `setupCommands(program)`:

```ts
import { myNewCommand } from './my-new-command.js';

program
  .command('my-new-command')
  .description('One-line description')
  .argument('[directory]', 'Directory to scan (default: current directory)', '.')
  .option('--dry-run', 'Preview without changing anything', false)
  .action(async (directory, options) => {
    const log = createLogger('my-new-command', program.opts().log ?? false);
    try { await myNewCommand(directory, { dryRun: options.dryRun }); }
    catch (error) { handleCliError(error, log); }
  });
```

Every command uses this exact `createLogger` + `try/catch handleCliError` wrapper - do not deviate.

## 3. Tests: `tests/unit/cli/<kebab-name>.test.ts`

Conventions (see `tests/unit/cli/clean-empty.test.ts`):

- Mock `fs` BEFORE importing the module under test:

```ts
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: { ...(actual as any).promises, stat: vi.fn(), readdir: vi.fn() }
  };
});
import { promises as fs } from 'fs';
import { myNewCommand } from '../../../src/cli/my-new-command.js';
```

- `beforeEach`: `vi.clearAllMocks()` and re-prime default mock returns.
- Assert output via `vi.spyOn(console, 'log')` and join the calls; restore the spy after.
- Cover at minimum: not-a-directory error, empty/no-op case, happy path, dry-run does NOT mutate, real run DOES mutate.
- Coverage must stay at 100% (statements, branches, functions, lines) - test every branch you add.

## 4. Verify

```bash
npx tsc --noEmit
npm run test:run
npm run test:coverage   # confirm thresholds still pass
```

## 5. Document

- Add the command to the README command list.
- Add it to the CLAUDE.md architecture section if it introduces a new pattern.
