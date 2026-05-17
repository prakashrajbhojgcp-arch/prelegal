"use client";

import { useCallback, useState } from "react";
import { NdaForm } from "./nda-form";
import { NdaPreview } from "./nda-preview";
import { defaultNdaData, type NdaData } from "@/lib/nda-schema";

type Props = {
  standardTerms: string;
};

export function NdaApp({ standardTerms }: Props) {
  const [data, setData] = useState<NdaData>(defaultNdaData);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Mutual NDA Creator
            </h1>
            <p className="text-xs text-slate-500">
              Common Paper Mutual NDA, Version 1.0 — fill in the details to
              generate a downloadable agreement.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          >
            Download PDF
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="no-print">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <NdaForm value={data} onChange={setData} />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Tip: use your browser&rsquo;s &ldquo;Save as PDF&rdquo; destination
            in the print dialog to download the agreement.
          </p>
        </section>

        <section>
          <NdaPreview value={data} standardTerms={standardTerms} />
        </section>
      </main>
    </div>
  );
}
