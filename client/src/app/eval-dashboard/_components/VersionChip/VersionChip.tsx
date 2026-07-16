/* VersionChip — blue, non-interactive "v7" text used in run tables.
   Deliberately renders no <a>/<button> and takes no click handler: AC-10
   requires the chip to never navigate. Presentational only. */

import { VERSION_PREFIX } from "./constants";
import { s } from "./styles";

export interface VersionChipProps {
  version: number;
}

export function VersionChip({ version }: VersionChipProps) {
  return (
    <span style={s.chip}>
      {VERSION_PREFIX}
      {version}
    </span>
  );
}
