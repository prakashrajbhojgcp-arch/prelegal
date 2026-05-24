import { NdaChatApp } from "@/components/nda-chat-app";
import {
  loadStandardTerms,
  loadStandardTermsBlocks,
} from "@/lib/templates";

export const metadata = {
  title: "Mutual NDA Creator · Prelegal",
};

export default async function MutualNdaPage() {
  const standardTerms = loadStandardTerms();
  const standardTermsBlocks = loadStandardTermsBlocks();
  return (
    <NdaChatApp
      standardTerms={standardTerms}
      standardTermsBlocks={standardTermsBlocks}
    />
  );
}
