"use client";

import { NdaForm } from "./nda-form";
import type { NdaData } from "@/lib/templates/mutual-nda/schema";

type Props = {
  value: NdaData;
  onChange: (next: NdaData) => void;
};

export function NdaEditPanel({ value, onChange }: Props) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-brand-navy hover:bg-slate-50">
        Edit fields manually
      </summary>
      <div className="border-t border-slate-200 p-6">
        <NdaForm value={value} onChange={onChange} />
      </div>
    </details>
  );
}
