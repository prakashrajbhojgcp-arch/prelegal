import { describe, expect, it } from "vitest";
import {
  inlineToPlainText,
  parseMarkdownBlocks,
  type Block,
} from "@/lib/markdown-blocks";

describe("parseMarkdownBlocks", () => {
  it("parses a level-1 heading", () => {
    const [block] = parseMarkdownBlocks("# Standard Terms");
    expect(block).toMatchObject({ kind: "heading", level: 1 });
    expect(inlineToPlainText((block as Extract<Block, { kind: "heading" }>).children)).toBe(
      "Standard Terms",
    );
  });

  it("clamps heading levels to a maximum of 3", () => {
    const [block] = parseMarkdownBlocks("##### Deep heading");
    expect(block).toMatchObject({ kind: "heading", level: 3 });
  });

  it("parses an ordered list and preserves the item numbers", () => {
    const blocks = parseMarkdownBlocks(
      "1. **First**. body one.\n2. **Second**. body two.\n3. **Third**. body three.",
    );
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ kind: "orderedItem", number: 1 });
    expect(blocks[1]).toMatchObject({ kind: "orderedItem", number: 2 });
    expect(blocks[2]).toMatchObject({ kind: "orderedItem", number: 3 });
  });

  it("captures bold inline runs as separate nodes", () => {
    const [block] = parseMarkdownBlocks(
      "1. **Introduction**. The Receiving Party shall use it.",
    );
    const item = block as Extract<Block, { kind: "orderedItem" }>;
    const first = item.children[0];
    expect(first.kind).toBe("bold");
    if (first.kind !== "bold") throw new Error("expected bold");
    expect(inlineToPlainText(first.children)).toBe("Introduction");
  });

  it("preserves links with their hrefs", () => {
    const [block] = parseMarkdownBlocks(
      "See [Common Paper](https://commonpaper.com) for details.",
    );
    const para = block as Extract<Block, { kind: "paragraph" }>;
    const link = para.children.find((c) => c.kind === "link");
    expect(link).toBeDefined();
    if (!link || link.kind !== "link") throw new Error("expected link");
    expect(link.href).toBe("https://commonpaper.com");
    expect(inlineToPlainText(link.children)).toBe("Common Paper");
  });

  it("ignores blank lines and horizontal rules between blocks", () => {
    const blocks = parseMarkdownBlocks("First paragraph.\n\n---\n\nSecond paragraph.");
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.kind === "paragraph")).toBe(true);
  });

  it("round-trips plain text through inlineToPlainText", () => {
    const blocks = parseMarkdownBlocks(
      "Hello **bold** and _italic_ and a [link](https://example.com).",
    );
    const text = inlineToPlainText(
      (blocks[0] as Extract<Block, { kind: "paragraph" }>).children,
    );
    expect(text).toBe("Hello bold and italic and a link.");
  });
});
