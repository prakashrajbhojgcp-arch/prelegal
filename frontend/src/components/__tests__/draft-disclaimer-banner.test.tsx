// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DraftDisclaimerBanner } from "@/components/draft-disclaimer-banner";

afterEach(cleanup);

describe("DraftDisclaimerBanner", () => {
  it("renders the full disclaimer copy with a note role", () => {
    render(<DraftDisclaimerBanner />);
    const banner = screen.getByRole("note", { name: /draft disclaimer/i });
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain("Prelegal generates drafts");
    expect(banner.textContent).toContain("subject to legal review");
  });

  it("has the no-print class so it doesn't appear in browser-PDF printouts", () => {
    render(<DraftDisclaimerBanner />);
    const banner = screen.getByRole("note", { name: /draft disclaimer/i });
    expect(banner.className).toContain("no-print");
  });
});
