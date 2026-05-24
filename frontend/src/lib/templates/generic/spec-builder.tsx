import { GenericForm } from "@/components/generic-form";
import { GenericPreview } from "@/components/generic-preview";
import type { TemplateSpec } from "../types";
import { GenericPdfDocument } from "./pdf-document";
import {
  buildDefaultGenericData,
  type FieldDef,
  type GenericData,
} from "./schema";

type BuildArgs = {
  slug: string;
  name: string;
  description: string;
  filename: string;
  pageSubtitle: string;
  pdfFilenamePrefix: string;
  greeting: string;
  manifest: FieldDef[];
  numParties: number;
};

/**
 * Build a TemplateSpec from a flat field manifest. All non-Mutual-NDA
 * templates use this — the per-template module just supplies the manifest,
 * slug, copy, and party count.
 */
export const buildGenericSpec = (args: BuildArgs): TemplateSpec<GenericData> => {
  const {
    slug,
    name,
    description,
    filename,
    pageSubtitle,
    pdfFilenamePrefix,
    greeting,
    manifest,
    numParties,
  } = args;

  return {
    slug,
    name,
    description,
    filename,
    pageTitle: `${name} Creator`,
    pageSubtitle,
    pdfFilenamePrefix,
    greeting,
    defaultData: buildDefaultGenericData(manifest, numParties),
    buildPdfNameSuffix: (data) =>
      data.parties.map((p) => p.company).filter(Boolean),
    FormComponent: (props) => (
      <GenericForm manifest={manifest} {...props} />
    ),
    PreviewComponent: (props) => (
      <GenericPreview
        name={name}
        manifest={manifest}
        {...props}
      />
    ),
    PdfDocument: (props) => (
      <GenericPdfDocument
        name={name}
        manifest={manifest}
        {...props}
      />
    ),
  };
};
