"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChatError,
  recommendTemplate,
  type RecommendResponse,
} from "@/lib/templates/chat-client";

type Status = "idle" | "loading" | "error";

export function RecommendGateway() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) return;
    setStatus("loading");
    setErrorMessage(null);
    setResult(null);
    try {
      const response = await recommendTemplate(trimmed);
      setResult(response);
      setStatus("idle");
    } catch (err) {
      const detail =
        err instanceof ChatError ? err.detail : "Couldn't reach the AI.";
      setErrorMessage(detail);
      setStatus("error");
    }
  };

  const goToTemplate = () => {
    if (result) router.push(`/dashboard/templates/${result.slug}`);
  };

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-label="Describe what you need"
    >
      <h2 className="text-lg font-semibold text-brand-navy">
        Not sure which template?
      </h2>
      <p className="mt-1 text-sm text-brand-gray">
        Describe the document you need and we&apos;ll point you to the right
        one (or the closest we generate).
      </p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='e.g. "an NDA between two startups exploring a partnership"'
          rows={3}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
          disabled={status === "loading"}
          data-testid="recommend-input"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === "loading" || description.trim() === ""}
            className="inline-flex items-center gap-2 rounded-md bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple/90 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="recommend-submit"
          >
            {status === "loading" ? "Thinking…" : "Recommend a template"}
          </button>
          {status === "error" && errorMessage ? (
            <span className="text-xs text-red-600" role="alert">
              {errorMessage}
            </span>
          ) : null}
        </div>
      </form>

      {result ? (
        <div
          className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
          data-testid="recommend-result"
          role="status"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-brand-gray">
                {result.kind === "supported"
                  ? "Recommended"
                  : "Closest match we generate"}
              </p>
              <p className="text-sm font-semibold text-brand-navy">
                {result.name}
              </p>
              <p className="text-sm text-slate-700">{result.explanation}</p>
            </div>
            <button
              type="button"
              onClick={goToTemplate}
              className="shrink-0 rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue/90 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
              data-testid="recommend-go"
            >
              Open creator →
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
