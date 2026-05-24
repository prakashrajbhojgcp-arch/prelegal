import type { ChatMessage, ChatResponse } from "./chat-types";

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

export async function sendChatTurn<Data>(
  slug: string,
  messages: ChatMessage[],
  currentFields: Data,
): Promise<ChatResponse<Data>> {
  const response = await fetch(`/api/templates/${slug}/chat`, {
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

  return (await response.json()) as ChatResponse<Data>;
}

export type RecommendResponse = {
  kind: "supported" | "unsupported";
  slug: string;
  name: string;
  explanation: string;
};

/**
 * Gateway "describe what document you need" call. Returns either a
 * supported template slug (with the original description as the kind),
 * or an unsupported flag with the closest supported substitute.
 */
export async function recommendTemplate(
  description: string,
): Promise<RecommendResponse> {
  const response = await fetch("/api/templates/recommend", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
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

  return (await response.json()) as RecommendResponse;
}
