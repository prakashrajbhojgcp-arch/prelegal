import { NdaForm } from "@/components/nda-form";
import { NdaPreview } from "@/components/nda-preview";
import type { TemplateSpec } from "../types";
import { NdaPdfDocument } from "./pdf-document";
import { defaultNdaData, type NdaData } from "./schema";

export const spec: TemplateSpec<NdaData> = {
  slug: "mutual-nda",
  name: "Mutual NDA",
  description:
    "Common Paper standard Mutual Non-Disclosure Agreement (Standard Terms) for protecting confidential information exchanged between two parties.",
  filename: "Mutual-NDA.md",
  pageTitle: "Mutual NDA Creator",
  pageSubtitle:
    "Tell the assistant about your agreement — the preview fills in as you chat.",
  pdfFilenamePrefix: "Mutual-NDA",
  greeting:
    "Hi — I'll help you draft a Common Paper Mutual NDA. To start: what are the names of the two companies entering this agreement?",
  defaultData: defaultNdaData,
  buildPdfNameSuffix: (data) =>
    [data.party1.company, data.party2.company].filter(Boolean),
  FormComponent: NdaForm,
  PreviewComponent: NdaPreview,
  PdfDocument: NdaPdfDocument,
};
