import { notFound } from "next/navigation";
import { TemplateChatApp } from "@/components/template-chat-app";
import { getTemplateSpec } from "@/lib/templates/registry";
import {
  loadTemplateBlocks,
  loadTemplateMarkdown,
} from "@/lib/templates/loader";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const spec = getTemplateSpec(slug);
  return {
    title: spec
      ? `${spec.name} Creator · Prelegal`
      : "Template not found · Prelegal",
  };
}

export default async function TemplateCreatorPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const spec = getTemplateSpec(slug);
  if (!spec) {
    notFound();
  }
  const standardTerms = loadTemplateMarkdown(spec.filename);
  const standardTermsBlocks = loadTemplateBlocks(spec.filename);
  return (
    <TemplateChatApp
      spec={spec}
      standardTerms={standardTerms}
      standardTermsBlocks={standardTermsBlocks}
    />
  );
}
