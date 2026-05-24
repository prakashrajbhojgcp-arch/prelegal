"use client";

import { useCallback, useState } from "react";
import { NdaChat, type ChatStatus } from "./nda-chat";
import { NdaPreview } from "./nda-preview";
import { NdaEditPanel } from "./nda-edit-panel";
import type { Block } from "@/lib/markdown-blocks";
import { defaultNdaData, type NdaData } from "@/lib/templates/mutual-nda/schema";
import type { ChatMessage } from "@/lib/templates/chat-types";
import { sendChatTurn, ChatError } from "@/lib/templates/chat-client";

type Props = {
  standardTerms: string;
  standardTermsBlocks: Block[];
};

type DownloadStatus = "idle" | "generating" | "error";

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi — I'll help you draft a Common Paper Mutual NDA. To start: what are the names of the two companies entering this agreement?",
};

const MAX_MESSAGES = 60;

const buildPdfFileName = (data: NdaData): string => {
  const slug = (s: string) =>
    s.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const parts = [slug(data.party1.company), slug(data.party2.company)].filter(Boolean);
  return parts.length > 0
    ? `Mutual-NDA-${parts.join("-")}.pdf`
    : "Mutual-NDA.pdf";
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const capMessages = (msgs: ChatMessage[]): ChatMessage[] =>
  msgs.length <= MAX_MESSAGES ? msgs : msgs.slice(msgs.length - MAX_MESSAGES);

export function NdaChatApp({ standardTerms, standardTermsBlocks }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [fields, setFields] = useState<NdaData>(defaultNdaData);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");

  const handleSend = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = { role: "user", content };
      const nextMessages = capMessages([...messages, userMessage]);
      setMessages(nextMessages);
      setChatStatus("sending");
      setErrorMessage(null);
      try {
        const result = await sendChatTurn<NdaData>("mutual-nda", nextMessages, fields);
        setMessages(
          capMessages([
            ...nextMessages,
            { role: "assistant", content: result.assistantMessage },
          ]),
        );
        setFields(result.mergedFields);
        setIsComplete(result.isComplete);
        setChatStatus("idle");
      } catch (err) {
        const detail =
          err instanceof ChatError ? err.detail : "Couldn't reach the AI.";
        setErrorMessage(detail);
        setChatStatus("error");
      }
    },
    [messages, fields],
  );

  const handleReset = useCallback(() => {
    setMessages([GREETING]);
    setFields(defaultNdaData());
    setChatStatus("idle");
    setErrorMessage(null);
    setIsComplete(false);
  }, []);

  const handleDownload = useCallback(async () => {
    setDownloadStatus("generating");
    try {
      const [{ pdf }, { NdaPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/templates/mutual-nda/pdf-document"),
      ]);
      const blob = await pdf(
        <NdaPdfDocument
          data={fields}
          standardTermsBlocks={standardTermsBlocks}
        />,
      ).toBlob();
      triggerBlobDownload(blob, buildPdfFileName(fields));
      setDownloadStatus("idle");
    } catch (err) {
      console.error("Failed to generate NDA PDF", err);
      setDownloadStatus("error");
    }
  }, [fields, standardTermsBlocks]);

  return (
    <div className="space-y-8">
      <header className="no-print flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">
            Mutual NDA Creator
          </h1>
          <p className="mt-1 text-sm text-brand-gray">
            Tell the assistant about your agreement — the preview fills in as you chat.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div className="flex items-center gap-3">
            {isComplete ? (
              <span className="text-xs font-medium text-emerald-700">
                ✓ Ready to download
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloadStatus === "generating"}
              data-testid="download-pdf"
              className="inline-flex items-center gap-2 rounded-md bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple/90 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadStatus === "generating" ? "Generating…" : "Download PDF"}
            </button>
          </div>
          {downloadStatus === "error" ? (
            <p className="text-xs text-red-600" role="alert">
              Could not generate the PDF. Check the console and try again.
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section className="no-print">
          <NdaChat
            messages={messages}
            status={chatStatus}
            errorMessage={errorMessage}
            onSend={handleSend}
            onReset={handleReset}
          />
        </section>
        <section>
          <NdaPreview value={fields} standardTerms={standardTerms} />
        </section>
      </div>

      <section className="no-print">
        <NdaEditPanel value={fields} onChange={setFields} />
      </section>
    </div>
  );
}
