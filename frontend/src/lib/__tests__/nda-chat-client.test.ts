import { afterEach, describe, expect, it, vi } from "vitest";
import { sendChatTurn, ChatError } from "@/lib/templates/chat-client";
import type { ChatMessage } from "@/lib/templates/chat-types";
import { defaultNdaData } from "@/lib/templates/mutual-nda/schema";

describe("sendChatTurn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to the chat endpoint with messages + current fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          assistantMessage: "Got it.",
          mergedFields: defaultNdaData(),
          isComplete: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const messages: ChatMessage[] = [
      { role: "assistant", content: "Hi" },
      { role: "user", content: "Acme" },
    ];
    const result = await sendChatTurn("mutual-nda", messages, defaultNdaData());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/templates/mutual-nda/chat");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init.body)).toEqual({
      messages,
      current_fields: defaultNdaData(),
    });
    expect(result.assistantMessage).toBe("Got it.");
    expect(result.isComplete).toBe(false);
  });

  it("throws a typed ChatError on non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "AI service unavailable" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendChatTurn("mutual-nda", [{ role: "user", content: "hi" }], defaultNdaData()),
    ).rejects.toMatchObject({
      name: "ChatError",
      status: 502,
      detail: "AI service unavailable",
    });
    await expect(
      sendChatTurn("mutual-nda", [{ role: "user", content: "hi" }], defaultNdaData()),
    ).rejects.toBeInstanceOf(ChatError);
  });
});
