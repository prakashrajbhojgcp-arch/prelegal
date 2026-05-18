import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parseMarkdownBlocks, type Block } from "./markdown-blocks";

const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

export const loadStandardTerms = (): string => {
  const raw = fs.readFileSync(
    path.join(TEMPLATES_DIR, "Mutual-NDA.md"),
    "utf-8",
  );
  // The source template highlights cross-references to the cover page with
  // <span class="coverpage_link">Term</span>. react-markdown strips raw HTML
  // by default, which would drop the term entirely — rewrite to bold text so
  // the cross-references remain readable in the rendered output.
  return raw.replace(
    /<span class="coverpage_link">([^<]+)<\/span>/g,
    "**$1**",
  );
};

export const loadStandardTermsBlocks = (): Block[] =>
  parseMarkdownBlocks(loadStandardTerms());
