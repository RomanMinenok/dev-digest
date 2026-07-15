/* RangePicker — controlled 7/30/90-day lookback selector for the Eval
   Dashboard. Presentational only: the owning page holds the `days` state
   (URL search param preferred, per react-best-practices — range is
   URL-dependent state). Defaults live in ./constants (AC-19: 30). */

import { useTranslations } from "next-intl";
import { Chip, Icon } from "@devdigest/ui";
import { EVAL_RANGE_OPTIONS, type EvalRangeDays } from "./constants";
import { s } from "./styles";

export interface RangePickerProps {
  value: EvalRangeDays;
  onChange: (value: EvalRangeDays) => void;
}

export function RangePicker({ value, onChange }: RangePickerProps) {
  const t = useTranslations("eval");

  return (
    <span style={s.wrap}>
      <Icon.Calendar size={14} style={{ color: "var(--text-secondary)" }} />
      {EVAL_RANGE_OPTIONS.map((option) => (
        <Chip
          key={option.value}
          active={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {t(`agentScreen.range.${option.labelKey}`)}
        </Chip>
      ))}
    </span>
  );
}
