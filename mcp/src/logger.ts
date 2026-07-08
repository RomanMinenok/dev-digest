/**
 * stdio reserves stdout for JSON-RPC framing — every log line MUST go to stderr.
 * Never use console.log in this package.
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

function write(level: string, message: string, meta?: Record<string, unknown>): void {
  const line = meta ? `[${level}] ${message} ${JSON.stringify(meta)}` : `[${level}] ${message}`;
  console.error(line);
}

export function createLogger(): Logger {
  return {
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  };
}
