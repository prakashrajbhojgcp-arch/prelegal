import { RecommendGateway } from "@/components/recommend-gateway";
import { TemplateCard } from "@/components/template-card";
import { loadCatalog } from "@/lib/catalog";

export default async function DashboardPage() {
  const catalog = await loadCatalog();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">
          Templates
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Browse the document library, or describe what you need and we&apos;ll
          recommend the right template.
        </p>
      </header>

      <RecommendGateway />

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
