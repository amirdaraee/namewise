export interface NamewiseErrorOptions {
  hint?: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class NamewiseError extends Error {
  readonly hint?: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, opts?: NamewiseErrorOptions) {
    super(message, { cause: opts?.cause });
    this.name = this.constructor.name;
    this.hint = opts?.hint;
    this.details = opts?.details;
  }
}

export class AuthError extends NamewiseError {
  constructor(message: string, opts?: NamewiseErrorOptions) {
    super(message, {
      hint: 'Check your API key — ensure ANTHROPIC_API_KEY or OPENAI_API_KEY is set, or run: namewise config set apiKey YOUR_KEY',
      ...opts
    });
  }
}

export class NetworkError extends NamewiseError {
  constructor(message: string, opts?: NamewiseErrorOptions) {
    super(message, {
      hint: 'Check your internet connection or try --provider ollama for local processing',
      ...opts
    });
  }
}

export class RateLimitError extends NamewiseError {
  constructor(message: string, opts?: NamewiseErrorOptions) {
    super(message, {
      hint: 'You have hit the provider rate limit — wait a moment and try again, or reduce concurrency with --concurrency 1',
      ...opts
    });
  }
}

export class ParseError extends NamewiseError {
  constructor(message: string, opts?: NamewiseErrorOptions) {
    super(message, {
      hint: 'The file may be corrupt or in an unsupported format',
      ...opts
    });
  }
}

export class FileSizeError extends NamewiseError {
  constructor(message: string, opts?: NamewiseErrorOptions) {
    super(message, {
      hint: 'Use --max-size to increase the limit, e.g. --max-size 20',
      ...opts
    });
  }
}

export class UnsupportedTypeError extends NamewiseError {
  constructor(message: string, opts?: NamewiseErrorOptions) {
    super(message, {
      hint: 'Run namewise info <file> to see which file types are supported',
      ...opts
    });
  }
}

export class ConfigError extends NamewiseError {
  constructor(message: string, opts?: NamewiseErrorOptions) {
    super(message, {
      hint: 'Run namewise config list to see valid configuration keys and values',
      ...opts
    });
  }
}

export class VisionError extends NamewiseError {
  constructor(message: string, opts?: NamewiseErrorOptions) {
    super(message, {
      hint: 'Use --provider claude or --provider openai for vision support',
      ...opts
    });
  }
}
