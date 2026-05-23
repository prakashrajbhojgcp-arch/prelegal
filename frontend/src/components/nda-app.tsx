"use client";

import { useCallback, useState } from "react";
import { NdaForm } from "./nda-form";
import { NdaPreview } from "./nda-preview";
import type { Block } from "@/lib/markdown-blocks";
import { defaultNdaData, type NdaData } from "@/lib/nda-schema";

type Props = {
  standardTerms: string;
  standardTermsBlocks: Block[];
};

type DownloadStatus = "idle" | "generating" | "error";

const buildPdfFileName = (data: NdaData): string => {
  const slug = (s: string) =>
    s
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [
    slug(data.party1.company),
    slug(data.party2.company),
  ].filter(Boolean);
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

export function NdaApp({ standardTerms, standardTermsBlocks }: Props) {
  const [data, setData] = useState<NdaData>(defaultNdaData);
  const [status, setStatus] = useState<DownloadStatus>("idle");

  const handleDownload = useCallback(async () => {
    setStatus("generating");
    try {
      const [{ pdf }, { NdaPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/nda-pdf-document"),
      ]);
      const blob = await pdf(
        <NdaPdfDocument
          data={data}
          standardTermsBlocks={standardTermsBlocks}
        />,
      ).toBlob();
      triggerBlobDownload(blob, buildPdfFileName(data));
      setStatus("idle");
    } catch (err) {
      console.error("Failed to generate NDA PDF", err);
      setStatus("error");
    }
  }, [data, standardTermsBlocks]);

  return (
    <div className="space-y-8">
      <header className="no-print flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">
            Mutual NDA Creator
          </h1>
          <p className="mt-1 text-sm text-brand-gray">
            Common Paper Mutual NDA, Version 1.0 — fill in the details to
            generate a downloadable agreement.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            onClick={handleDownload}
            disabled={status === "generating"}
            data-testid="download-pdf"
            className="inline-flex items-center gap-2 rounded-md bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple/90 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "generating" ? "Generating…" : "Download PDF"}
          </button>
          {status === "error" ? (
            <p className="text-xs text-red-600" role="alert">
              Could not generate the PDF. Check the console and try again.
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section className="no-print">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <NdaForm value={data} onChange={setData} />
          </div>
        </section>

        <section>
          <NdaPreview value={data} standardTerms={standardTerms} />
        </section>
      </div>
    </div>
  );
}
