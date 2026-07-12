/**
 * project-context module constants.
 *
 * The `.md` discovery walk (see `walk.ts`) reuses `EXCLUDED_DIRS` from
 * repo-intel — the same non-content directories (node_modules, dist, .git,
 * etc.) should never be scanned for markdown either. No other repo-intel
 * pipeline object/constant is depended on here by design (SPEC-01 T6):
 * project-context stays a standalone, dependency-light module so a later
 * `service.ts` (T7) can inject the walk behind a port instead of importing
 * filesystem logic directly into business logic.
 */
export { EXCLUDED_DIRS } from '../repo-intel/constants.js';

/** File extension this module discovers. Unlike repo-intel's code walk,
 * there is deliberately no `MAX_INDEXED_FILES` / size cap here (SPEC-01). */
export const MD_EXT = '.md';
