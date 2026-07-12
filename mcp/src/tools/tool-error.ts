import { ApiError } from '../ports.js';
import { ResolutionError } from '../resolver.js';

/** Maps a caught error to an MCP tool error result. Infra/application throw; presentation formats. */
export function toErrorResult(err: unknown) {
  const message =
    err instanceof ApiError || err instanceof ResolutionError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}
