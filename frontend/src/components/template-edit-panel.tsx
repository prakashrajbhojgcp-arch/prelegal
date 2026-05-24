"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * Collapsible "Edit fields manually" wrapper used on every template's
 * creator page. The inner form is supplied by the template's spec.
 */
export function TemplateEditPanel({ children }: Props) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white p-5 open:shadow-sm">
      <summary className="cursor-pointer select-none text-sm font-medium text-brand-navy">
        Edit fields manually
      </summary>
      <div className="mt-5">{children}</div>
    </details>
  );
}
