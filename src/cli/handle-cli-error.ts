import { NamewiseError } from '../errors.js';
import { createLogger } from '../utils/logger.js';
import * as ui from '../utils/ui.js';

/**
 * Shared error handler for CLI command actions: logs the error, prints a
 * user-facing message (with hint), and exits with code 1.
 */
export async function handleCliError(error: unknown, log: ReturnType<typeof createLogger>): Promise<never> {
  log.error(error);
  if (error instanceof NamewiseError) {
    ui.error(error.message);
    if (error.hint) ui.hint(error.hint);
  } else {
    ui.error('An unexpected error occurred.');
    if (log.enabled) {
      ui.hint(`See log: ${log.currentLogPath}`);
    } else {
      ui.hint('Run with --log for detailed error information.');
    }
  }
  // process.exit does not wait for pending async writes — flush the log first
  await log.flush();
  process.exit(1);
}
