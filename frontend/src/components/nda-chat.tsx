"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/templates/chat-types";

export type ChatStatus = "idle" | "sending" | "error";

type Props = {
  messages: ChatMessage[];
  status: ChatStatus;
  errorMessage: string | null;
  onSend: (content: string) => void;
  onReset: () => void;
};

export function NdaChat({
  messages,
  status,
  errorMessage,
  onSend,
  onReset,
}: Props) {
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, status]);

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && status !== "sending";

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setDraft("");
  };

  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  return (
    <div className="flex h-[640px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-navy">Chat</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-brand-gray hover:text-brand-navy"
        >
          Start over
        </button>
      </header>

      <div
        ref={threadRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
        data-testid="chat-thread"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-md px-3 py-2 text-sm",
              m.role === "assistant"
                ? "bg-blue-50 text-slate-900"
                : "bg-slate-100 text-slate-900 ml-auto",
            )}
          >
            {m.content}
          </div>
        ))}
        {status === "sending" ? (
          <p className="text-xs italic text-brand-gray">Sending…</p>
        ) : null}
      </div>

      {status === "error" && errorMessage ? (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <span>{errorMessage}</span>
          {lastUser ? (
            <button
              type="button"
              onClick={() => onSend(lastUser.content)}
              className="ml-2 underline"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-slate-200 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Type a message…"
          className="block w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={!canSend}
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-md bg-brand-purple px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-purple/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
