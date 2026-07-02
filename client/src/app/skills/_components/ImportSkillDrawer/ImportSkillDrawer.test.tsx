import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/skills.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const previewMutateAsync = vi.fn();
const createMutateAsync = vi.fn();
vi.mock("../../../../lib/hooks/skills", () => ({
  useImportSkillPreview: () => ({ mutateAsync: previewMutateAsync, isPending: false }),
  useCreateSkill: () => ({ mutateAsync: createMutateAsync, isPending: false }),
}));

import { ImportSkillDrawer } from "./ImportSkillDrawer";

afterEach(() => {
  cleanup();
  push.mockClear();
  previewMutateAsync.mockReset();
  createMutateAsync.mockReset();
});

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ImportSkillDrawer", () => {
  it("previews a picked file, then saves it as an extracted+disabled skill and navigates", async () => {
    previewMutateAsync.mockResolvedValue({
      name: "no-then-chains",
      description: "Avoid .then() chains",
      type: "convention",
      body: "# No then chains",
      source: "extracted",
    });
    createMutateAsync.mockResolvedValue({ id: "new1" });

    const { container } = renderWithIntl(<ImportSkillDrawer onClose={() => {}} />);

    const input = container.querySelector('input[type="file"]')!;
    const file = new File(["# No then chains"], "no-then-chains.md", { type: "text/markdown" });
    fireEvent.change(input, { target: { files: [file] } });

    // Preview was requested with the file wrapped in FormData.
    await waitFor(() => expect(previewMutateAsync).toHaveBeenCalledTimes(1));
    expect(previewMutateAsync.mock.calls[0]![0]).toBeInstanceOf(FormData);

    // The extracted preview renders.
    await screen.findByText("Extracted skill");

    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutateAsync.mock.calls[0]![0]).toMatchObject({
      name: "no-then-chains",
      type: "convention",
      body: "# No then chains",
      source: "extracted",
      enabled: false,
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/skills/new1?tab=config"));
  });

  it("surfaces an import failure message and does not render the preview", async () => {
    previewMutateAsync.mockRejectedValue(new Error("boom"));
    const { container } = renderWithIntl(<ImportSkillDrawer onClose={() => {}} />);

    const input = container.querySelector('input[type="file"]')!;
    const file = new File(["x"], "bad.md", { type: "text/markdown" });
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText("Import failed");
    expect(screen.queryByText("Extracted skill")).toBeNull();
  });
});
