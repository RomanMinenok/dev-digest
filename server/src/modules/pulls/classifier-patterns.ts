// Evaluation order matters: boilerplate is checked before wiring, since a
// migration `.sql` file would otherwise also match a "schema" wiring pattern.

export const BOILERPLATE_PATTERNS: RegExp[] = [
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)__snapshots__\//,
  /\.snap$/,
  /_migration\.sql$/,
  /(^|\/)db\/migrations\//,
  /\.generated\.ts$/,
];

export const WIRING_PATTERNS: RegExp[] = [
  /(^|\/)index\.tsx?$/,
  /(^|\/)routes\.ts$/,
  /\.config\.[jt]s$/,
  /(^|\/)tsconfig.*\.json$/,
  /(^|\/)\.eslintrc.*$/,
  /(^|\/)vite\.config\.[jt]s$/,
  /(^|\/)schema\.ts$/,
  /(^|\/)db\/schema\//,
  /(^|\/)container\.ts$/,
  /(^|\/)app\.ts$/,
  /(^|\/)server\.ts$/,
];
