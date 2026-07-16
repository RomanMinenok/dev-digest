/* CostCell — "$0.23" cost readout for a version run row.
   Renders "—" — never "$0.00" — when cost_usd is null (no case run in the
   version reported a cost). Presentational only. */

import { COST_LOCALE, COST_MAX_FRACTION_DIGITS, COST_MIN_FRACTION_DIGITS } from "./constants";
import { s } from "./styles";

export interface CostCellProps {
  costUsd: number | null;
}

export function CostCell({ costUsd }: CostCellProps) {
  if (costUsd === null) {
    return <span style={s.costUnavailable}>—</span>;
  }

  const formatted = costUsd.toLocaleString(COST_LOCALE, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: COST_MIN_FRACTION_DIGITS,
    maximumFractionDigits: COST_MAX_FRACTION_DIGITS,
  });

  return <span style={s.costCell}>{formatted}</span>;
}
