// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NdaEditPanel } from "@/components/nda-edit-panel";
import { defaultNdaData } from "@/lib/templates/mutual-nda/schema";

afterEach(cleanup);

describe("NdaEditPanel", () => {
  it("renders with the edit summary and form inside a details element", () => {
    render(
      <NdaEditPanel value={defaultNdaData()} onChange={vi.fn()} />,
    );
    // Check that the summary text is present
    expect(screen.getByText(/edit fields manually/i)).toBeDefined();
    // Check that the form is rendered (jsdom renders content inside closed details)
    expect(screen.getByLabelText("Purpose")).toBeDefined();
  });

  it("forwards form edits via onChange", () => {
    const onChange = vi.fn();
    render(
      <NdaEditPanel value={defaultNdaData()} onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText("Purpose"), {
      target: { value: "new purpose" },
    });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.purpose).toBe("new purpose");
  });
});
