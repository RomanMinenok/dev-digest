/** Constants for the skills module. */

/** Initial version recorded for a newly-created skill. */
export const INITIAL_SKILL_VERSION = 1;

/** Default skill source when none is supplied on create. */
export const DEFAULT_SKILL_SOURCE = 'manual' as const;

/** File extensions accepted by the import/preview endpoint. */
export const ACCEPTED_IMPORT_EXTENSIONS = ['.md', '.markdown', '.txt', '.zip'] as const;

/** Max upload size for skill imports (2 MB). */
export const IMPORT_FILE_SIZE_LIMIT = 2 * 1024 * 1024;
