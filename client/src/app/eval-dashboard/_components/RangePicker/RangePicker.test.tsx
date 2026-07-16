import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/eval.json";
import { RangePicker } from "./RangePicker";
import { EVAL_RANGE_DAYS_DEFAULT } from "./constants";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("RangePicker (AC-19)", () => {
  it("offers exactly the three supported ranges and defaults to 30", () => {
    expect(EVAL_RANGE_DAYS_DEFAULT).toBe(30);
    renderWithIntl(<RangePicker value={30} onChange={() => {}} />);
    expect(screen.getByText("7 days")).toBeInTheDocument();
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByText("90 days")).toBeInTheDocument();
  });

  it("calls onChange with the picked range", () => {
    const onChange = vi.fn();
    renderWithIntl(<RangePicker value={30} onChange={onChange} />);
    fireEvent.click(screen.getByText("7 days"));
    expect(onChange).toHaveBeenCalledWith(7);
  });
});
