import { NdaApp } from "@/components/nda-app";
import {
  loadStandardTerms,
  loadStandardTermsBlocks,
} from "@/lib/templates";
import type { Block } from "@/lib/markdown-blocks";

export default function Page() {
  let standardTerms: string;
  let standardTermsBlocks: Block[];
  try {
    standardTerms = loadStandardTerms();
    standardTermsBlocks = loadStandardTermsBlocks();
  } catch (err) {
    throw new Error(
      "Could not load Mutual NDA Standard Terms from ../templates/Mutual-NDA.md. " +
        "Make sure the templates/ directory is deployed alongside the app " +
        "(see next.config.ts output tracing).",
      { cause: err },
    );
  }
  return (
    <NdaApp
      standardTerms={standardTerms}
      standardTermsBlocks={standardTermsBlocks}
    />
  );
}
