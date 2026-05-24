// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { NdaChatApp } from "@/components/nda-chat-app";
import { defaultNdaData } from "@/lib/templates/mutual-nda/schema";
import type { Block } from "@/lib/markdown-blocks";
import * as chatClient from "@/lib/templates/chat-client";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const STANDARD_TERMS = "# Standard Terms\n\nDummy.";
const STANDARD_TERMS_BLOCKS: Block[] = [
  { kind: "paragraph", children: [{ kind: "text", value: "Dummy." }] },
];

describe("NdaChatApp", () => {
  it("renders the initial assistant greeting on mount", () => {
    render(
      <NdaChatApp
        standardTerms={STANDARD_TERMS}
        standardTermsBlocks={STANDARD_TERMS_BLOCKS}
      />,
    );
    expect(
      screen.getByText(/Hi — I'll help you draft a Common Paper Mutual NDA/),
    ).toBeDefined();
  });

  it("sends a chat turn, appends the assistant reply, and updates the preview", async () => {
    const next = defaultNdaData();
    next.party1.company = "Acme Inc.";
    const spy = vi
      .spyOn(chatClient, "sendChatTurn")
      .mockResolvedValue({
        assistantMessage: "Got it. What state should govern?",
        mergedFields: next,
        isComplete: false,
      });

    render(
      <NdaChatApp
        standardTerms={STANDARD_TERMS}
        standardTermsBlocks={STANDARD_TERMS_BLOCKS}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Type a message…"), {
      target: { value: "Acme Inc. and Globex Corp." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText("Got it. What state should govern?"),
    ).toBeDefined();
    // Preview shows the merged field value
    expect(screen.getAllByText("Acme Inc.").length).toBeGreaterThan(0);
  });

  it("shows the retry banner when sendChatTurn rejects", async () => {
    vi.spyOn(chatClient, "sendChatTurn").mockRejectedValue(
      new chatClient.ChatError(502, "AI service unavailable"),
    );

    render(
      <NdaChatApp
        standardTerms={STANDARD_TERMS}
        standardTermsBlocks={STANDARD_TERMS_BLOCKS}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Type a message…"), {
      target: { value: "hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/AI service unavailable/)).toBeDefined();
    expect(screen.getByRole("button", { name: /retry/i })).toBeDefined();
  });

  it("Start over resets messages back to the greeting and fields to defaults", async () => {
    const next = defaultNdaData();
    next.party1.company = "Acme Inc.";
    vi.spyOn(chatClient, "sendChatTurn").mockResolvedValue({
      assistantMessage: "ok",
      mergedFields: next,
      isComplete: false,
    });

    render(
      <NdaChatApp
        standardTerms={STANDARD_TERMS}
        standardTermsBlocks={STANDARD_TERMS_BLOCKS}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Type a message…"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText("ok");

    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    // Only the greeting should remain in the chat thread.
    expect(
      screen.getByText(/Hi — I'll help you draft a Common Paper Mutual NDA/),
    ).toBeDefined();
    expect(screen.queryByText("ok")).toBeNull();
  });

  it("shows a Ready chip and keeps Download enabled when is_complete arrives", async () => {
    vi.spyOn(chatClient, "sendChatTurn").mockResolvedValue({
      assistantMessage: "All set!",
      mergedFields: defaultNdaData(),
      isComplete: true,
    });

    render(
      <NdaChatApp
        standardTerms={STANDARD_TERMS}
        standardTermsBlocks={STANDARD_TERMS_BLOCKS}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Type a message…"), {
      target: { value: "done" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/Ready to download/i)).toBeDefined();
    const download = screen.getByTestId("download-pdf") as HTMLButtonElement;
    expect(download.disabled).toBe(false);
  });
});
