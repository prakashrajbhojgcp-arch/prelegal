import { NdaApp } from "@/components/nda-app";
import { loadStandardTerms } from "@/lib/templates";

export default function Page() {
  let standardTerms: string;
  try {
    standardTerms = loadStandardTerms();
  } catch (err) {
    throw new Error(
      "Could not load Mutual NDA Standard Terms from ../templates/Mutual-NDA.md. " +
        "Make sure the templates/ directory is deployed alongside the app " +
        "(see next.config.ts output tracing).",
      { cause: err },
    );
  }
  return <NdaApp standardTerms={standardTerms} />;
}
