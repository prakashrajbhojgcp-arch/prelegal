import Link from "next/link";

import type { CatalogTemplate } from "@/lib/api";

const MUTUAL_NDA_FILENAME = "Mutual-NDA.md";
const MUTUAL_NDA_ROUTE = "/dashboard/templates/mutual-nda";

export function TemplateCard({ template }: { template: CatalogTemplate }) {
  if (template.filename === MUTUAL_NDA_FILENAME) {
    return (
      <Link
        href={MUTUAL_NDA_ROUTE}
        className="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-2 hover:ring-brand-blue/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      >
        <h2 className="text-base font-semibold text-brand-navy">{template.name}</h2>
        <p className="mt-2 flex-1 text-sm text-brand-gray">{template.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-brand-blue">
            Available
          </span>
          <span className="rounded-md bg-brand-purple px-3 py-1.5 text-xs font-medium text-white">
            Create →
          </span>
        </div>
      </Link>
    );
  }

  return (
    <article className="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-brand-navy">{template.name}</h2>
      <p className="mt-2 flex-1 text-sm text-brand-gray">{template.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-brand-yellow">
          Coming soon
        </span>
        <button
          type="button"
          disabled
          className="rounded-md bg-brand-blue/20 px-3 py-1.5 text-xs font-medium text-brand-blue cursor-not-allowed"
        >
          Create
        </button>
      </div>
    </article>
  );
}
