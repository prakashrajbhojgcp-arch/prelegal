import type { ReactNode } from "react";
import type { Block } from "../markdown-blocks";

/**
 * A single "field" shown to the user inside a template's form / cover-page.
 * The user picked an "auto-generated cover page from field manifest"
 * approach, so the cover-page PDF reads `CoverField[]` and renders each as
 * a label + value pair.
 */
export type CoverField = {
  label: string;
  value: string;
  /** Set to `placeholder` to render the value in muted grey when empty. */
  emptyFallback?: string;
};

/**
 * A single row in the parties / signature table at the bottom of a cover
 * page. Each row has a left-hand label and N party-keyed values (one per
 * party column). Templates with two parties produce 2-element values; templates with one party produce 1-element values.
 */
export type PartyRow = {
  label: string;
  values: string[];
};

/**
 * Per-template form components receive this prop shape so the chat-app
 * can swap forms without knowing their internals.
 */
export type TemplateFormProps<Data> = {
  value: Data;
  onChange: (next: Data) => void;
};

/**
 * Per-template PDF-document component receives this prop shape. The
 * generic chat-app passes the current data and the pre-parsed standard-
 * terms body blocks.
 */
export type TemplatePdfProps<Data> = {
  data: Data;
  standardTermsBlocks: Block[];
};

/**
 * Per-template "preview" component shows the live in-page rendering of the
 * filled-in fields plus the standard-terms markdown.
 */
export type TemplatePreviewProps<Data> = {
  value: Data;
  standardTerms: string;
};

/**
 * Everything the generic chat-app needs to render and dispatch turns for a
 * given template. Specs are registered statically per template — see
 * `frontend/src/lib/templates/registry.ts`.
 */
export type TemplateSpec<Data> = {
  /** URL slug, e.g. `"mutual-nda"`. Matches the backend spec.slug. */
  slug: string;
  /** Display name, e.g. `"Mutual NDA"`. */
  name: string;
  /** Short description shown on the dashboard. */
  description: string;
  /** Markdown filename in the `templates/` directory. */
  filename: string;
  /** Page title shown on the create route. */
  pageTitle: string;
  /** Short sentence under the page title. */
  pageSubtitle: string;
  /** Output PDF filename prefix; templates append party slugs. */
  pdfFilenamePrefix: string;
  /** Opening assistant message when the chat starts. */
  greeting: string;
  /** Factory for a fresh starting state. */
  defaultData: () => Data;
  /** Build the slug-suffix portion of the PDF filename (joined with `-`). */
  buildPdfNameSuffix: (data: Data) => string[];
  /** Form component (per-template — uses any custom widgets it needs). */
  FormComponent: (props: TemplateFormProps<Data>) => ReactNode;
  /** Preview component for the live render in the dashboard. */
  PreviewComponent: (props: TemplatePreviewProps<Data>) => ReactNode;
  /** PDF document component, used by the Download PDF button. */
  PdfDocument: (props: TemplatePdfProps<Data>) => ReactNode;
};

/**
 * Minimum public-facing fields used by code that doesn't care about the
 * template's `Data` shape (e.g. catalog rendering, gateway recommend).
 */
export type AnyTemplateSpec = TemplateSpec<unknown>;
