import { RecommendGateway } from "@/components/recommend-gateway";
import { TemplateCard } from "@/components/template-card";
import { loadCatalog } from "@/lib/catalog";
import { DISCLAIMER_FULL } from "@/lib/disclaimer";

export default async function DashboardPage() {
  const catalog = await loadCatalog();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">
          Draft a document
        </h1>
        <p className="text-sm text-brand-gray max-w-2xl">
          Pick a template, chat with the AI to fill it in, and download a PDF.
          Or describe what you need and we&apos;ll recommend the right one.
        </p>
      </header>

      <RecommendGateway />

      <p
        role="note"
        aria-label="Draft disclaimer"
        className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900"
      >
        {DISCLAIMER_FULL}
      </p>

      <section
        aria-label="Available templates"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {catalog.templates.map((template) => (
          <TemplateCard key={template.filename} template={template} />
        ))}
      </section>
    </div>
  );
}
