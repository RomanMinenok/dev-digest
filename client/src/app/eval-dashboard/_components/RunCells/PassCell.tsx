/* PassCell — "17/20" passed-cases readout for a version run row.
   Presentational only: no hooks, no data fetching. */

import { s } from "./styles";

export interface PassCellProps {
  passed: number;
  total: number;
}

export function PassCell({ passed, total }: PassCellProps) {
  return (
    <span style={s.passCell}>
      {passed}/{total}
    </span>
  );
}
