"use client";

import { useCallback, useMemo, useState } from "react";
import { NdaChat, type ChatStatus } from "./nda-chat";
import { TemplateEditPanel } from "./template-edit-panel";
import type { Block } from "@/lib/markdown-blocks";
import type { ChatMessage } from "@/lib/templates/chat-types";
import { sendChatTurn, ChatError } from "@/lib/templates/chat-client";
import type { TemplateSpec } from "@/lib/templates/types";

type Props<Data> = {
  spec: TemplateSpec<Data>;
  standardTerms: string;
  standardTermsBlocks: Block[];
};

type DownloadStatus = "idle" | "generating" | "error";

const MAX_MESSAGES = 60;

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

const slugify = (s: string): string =>
  s.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const buildPdfFileName = <Data,>(spec: TemplateSpec<Data>, data: Data): string => {
  const suffix = spec
    .buildPdfNameSuffix(data)
    .map(slugify)
    .filter(Boolean);
  return suffix.length > 0
    ? `${spec.pdfFilenamePrefix}-${suffix.join("-")}.pdf`
    : `${spec.pdfFilenamePrefix}.pdf`;
};

/**
 * Generic creator UI — chat sidebar, live preview, edit panel, download
 * button. Works for any registered TemplateSpec.
 */
export function TemplateChatApp<Data>({
  spec,
  standardTerms,
  standardTermsBlocks,
}: Props<Data>) {
  const initialGreeting = useMemo<ChatMessage>(
    () => ({ role: "assistant", content: spec.greeting }),
    [spec.greeting],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([initialGreeting]);
  const [fields, setFields] = useState<Data>(() => spec.defaultData());
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
        const result = await sendChatTurn<Data>(
          spec.slug,
          nextMessages,
          fields,
        );
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
    [messages, fields, spec.slug],
  );

  const handleReset = useCallback(() => {
    setMessages([initialGreeting]);
    setFields(spec.defaultData());
    setChatStatus("idle");
    setErrorMessage(null);
    setIsComplete(false);
  }, [spec, initialGreeting]);

  const handleDownload = useCallback(async () => {
    setDownloadStatus("generating");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(
        <>
          {spec.PdfDocument({
            data: fields,
            standardTermsBlocks,
          })}
        </>,
      ).toBlob();
      triggerBlobDownload(blob, buildPdfFileName(spec, fields));
      setDownloadStatus("idle");
    } catch (err) {
      console.error(`Failed to generate PDF for ${spec.slug}`, err);
      setDownloadStatus("error");
    }
  }, [fields, spec, standardTermsBlocks]);

  return (
    <div className="space-y-8">
      <header className="no-print flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">
            {spec.pageTitle}
          </h1>
          <p className="mt-1 text-sm text-brand-gray">{spec.pageSubtitle}</p>
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
          {spec.PreviewComponent({
            value: fields,
            standardTerms,
          })}
        </section>
      </div>

      <section className="no-print">
        <TemplateEditPanel>
          {spec.FormComponent({ value: fields, onChange: setFields })}
        </TemplateEditPanel>
      </section>
    </div>
  );
}
