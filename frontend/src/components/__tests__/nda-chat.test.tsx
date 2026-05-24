// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NdaChat } from "@/components/nda-chat";
import type { ChatMessage } from "@/lib/nda-chat-types";

afterEach(cleanup);

const messages: ChatMessage[] = [
  { role: "assistant", content: "Hi — who are the parties?" },
];

describe("NdaChat", () => {
  it("renders messages and disables send while sending", () => {
    render(
      <NdaChat
        messages={messages}
        status="sending"
        errorMessage={null}
        onSend={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText("Hi — who are the parties?")).toBeDefined();
    const button = screen.getByRole("button", { name: /send/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/sending/i)).toBeDefined();
  });

  it("calls onSend with trimmed text when the user submits", () => {
    const onSend = vi.fn();
    render(
      <NdaChat
        messages={messages}
        status="idle"
        errorMessage={null}
        onSend={onSend}
        onReset={vi.fn()}
      />,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "  Acme Inc.  " } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith("Acme Inc.");
  });

  it("disables send when textarea is empty after trim", () => {
    render(
      <NdaChat
        messages={messages}
        status="idle"
        errorMessage={null}
        onSend={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: /send/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(button.disabled).toBe(true);
  });

  it("shows the retry banner on error and re-sends the last user message on click", () => {
    const onSend = vi.fn();
    render(
      <NdaChat
        messages={[
          ...messages,
          { role: "user", content: "Acme Inc." },
        ]}
        status="error"
        errorMessage="AI service unavailable"
        onSend={onSend}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText(/AI service unavailable/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onSend).toHaveBeenCalledWith("Acme Inc.");
  });

  it("Start over invokes onReset", () => {
    const onReset = vi.fn();
    render(
      <NdaChat
        messages={messages}
        status="idle"
        errorMessage={null}
        onSend={vi.fn()}
        onReset={onReset}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    expect(onReset).toHaveBeenCalled();
  });
});
