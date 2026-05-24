import type {
  ChatMessage,
  ChatResponse,
} from "./nda-chat-types";
import type { NdaData } from "./nda-schema";

export class ChatError extends Error {
  readonly name = "ChatError";
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`Chat request failed (${status}): ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

export async function sendChatTurn(
  messages: ChatMessage[],
  currentFields: NdaData,
): Promise<ChatResponse> {
  const response = await fetch("/api/templates/mutual-nda/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, current_fields: currentFields }),
  });

  if (!response.ok) {
    let detail = response.statusText || "Request failed";
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // fall through with statusText
    }
    throw new ChatError(response.status, detail);
  }

  return (await response.json()) as ChatResponse;
}
