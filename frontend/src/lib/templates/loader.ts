import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parseMarkdownBlocks, type Block } from "../markdown-blocks";

const TEMPLATES_DIR =
  process.env.PRELEGAL_TEMPLATES_DIR ??
  path.join(process.cwd(), "..", "templates");

/**
 * Returns the markdown body of a Common Paper template, with the inline
 * `<span class="..._link">Term</span>` cross-references rewritten to bold
 * text. react-markdown strips raw HTML by default, which would drop the
 * referenced term entirely.
 */
export const loadTemplateMarkdown = (filename: string): string => {
  const raw = fs.readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8");
  return raw.replace(
    /<span class="[a-z_]+_link">([^<]+)<\/span>/g,
    "**$1**",
  );
};

export const loadTemplateBlocks = (filename: string): Block[] =>
  parseMarkdownBlocks(loadTemplateMarkdown(filename));

// Legacy helpers preserved for the Mutual NDA route + existing tests.
export const loadStandardTerms = (): string =>
  loadTemplateMarkdown("Mutual-NDA.md");

export const loadStandardTermsBlocks = (): Block[] =>
  parseMarkdownBlocks(loadStandardTerms());
