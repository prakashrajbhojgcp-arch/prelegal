import Link from "next/link";

import type { CatalogTemplate } from "@/lib/api";

const slugFor = (filename: string): string =>
  filename.replace(/\.md$/i, "").toLowerCase();

export function TemplateCard({ template }: { template: CatalogTemplate }) {
  const slug = slugFor(template.filename);
  const href = `/dashboard/templates/${slug}`;

  return (
    <Link
      href={href}
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
