// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecommendGateway } from "@/components/recommend-gateway";
import * as chatClient from "@/lib/templates/chat-client";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe("RecommendGateway", () => {
  it("disables the submit button until the user types something", () => {
    render(<RecommendGateway />);
    const submit = screen.getByTestId(
      "recommend-submit",
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("recommend-input"), {
      target: { value: "an NDA" },
    });
    expect(submit.disabled).toBe(false);
  });

  it("renders a 'Recommended' result for a supported response and routes when clicked", async () => {
    vi.spyOn(chatClient, "recommendTemplate").mockResolvedValue({
      kind: "supported",
      slug: "mutual-nda",
      name: "Mutual NDA",
      explanation: "Looks like a mutual NDA.",
    });

    render(<RecommendGateway />);

    fireEvent.change(screen.getByTestId("recommend-input"), {
      target: { value: "two startups exchanging secrets" },
    });
    fireEvent.click(screen.getByTestId("recommend-submit"));

    const result = await screen.findByTestId("recommend-result");
    expect(result.textContent).toContain("Recommended");
    expect(result.textContent).toContain("Mutual NDA");
    expect(result.textContent).toContain("Looks like a mutual NDA.");

    fireEvent.click(screen.getByTestId("recommend-go"));
    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/templates/mutual-nda",
    );
  });

  it("renders an 'Unsupported — closest match' result and routes there", async () => {
    vi.spyOn(chatClient, "recommendTemplate").mockResolvedValue({
      kind: "unsupported",
      slug: "csa",
      name: "Cloud Service Agreement (CSA)",
      explanation:
        "We don't generate employment contracts, but a CSA is the closest commercial template we produce.",
    });

    render(<RecommendGateway />);

    fireEvent.change(screen.getByTestId("recommend-input"), {
      target: { value: "an employment contract" },
    });
    fireEvent.click(screen.getByTestId("recommend-submit"));

    const result = await screen.findByTestId("recommend-result");
    expect(result.textContent).toContain("Closest match we generate");
    expect(result.textContent).toContain("Cloud Service Agreement");

    fireEvent.click(screen.getByTestId("recommend-go"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/templates/csa");
  });

  it("surfaces a ChatError detail next to the submit button", async () => {
    vi.spyOn(chatClient, "recommendTemplate").mockRejectedValue(
      new chatClient.ChatError(502, "AI service unavailable"),
    );

    render(<RecommendGateway />);

    fireEvent.change(screen.getByTestId("recommend-input"), {
      target: { value: "any document" },
    });
    fireEvent.click(screen.getByTestId("recommend-submit"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "AI service unavailable",
    );
  });
});
