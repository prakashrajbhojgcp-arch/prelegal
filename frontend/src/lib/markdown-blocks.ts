import { marked, type Tokens } from "marked";

export type Inline =
  | { kind: "text"; value: string }
  | { kind: "bold"; children: Inline[] }
  | { kind: "italic"; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] };

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "orderedItem"; number: number; children: Inline[] };

const walkInline = (tokens: readonly Tokens.Generic[]): Inline[] => {
  const out: Inline[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "text": {
        const tt = t as Tokens.Text;
        if (tt.tokens && tt.tokens.length > 0) {
          out.push(...walkInline(tt.tokens));
        } else {
          out.push({ kind: "text", value: tt.text });
        }
        break;
      }
      case "escape": {
        out.push({ kind: "text", value: (t as Tokens.Escape).text });
        break;
      }
      case "strong": {
        const st = t as Tokens.Strong;
        out.push({ kind: "bold", children: walkInline(st.tokens ?? []) });
        break;
      }
      case "em": {
        const et = t as Tokens.Em;
        out.push({ kind: "italic", children: walkInline(et.tokens ?? []) });
        break;
      }
      case "link": {
        const lt = t as Tokens.Link;
        out.push({
          kind: "link",
          href: lt.href,
          children: walkInline(lt.tokens ?? []),
        });
        break;
      }
      case "br": {
        out.push({ kind: "text", value: "\n" });
        break;
      }
      case "codespan": {
        out.push({ kind: "text", value: (t as Tokens.Codespan).text });
        break;
      }
      case "html": {
        // Inline HTML in our templates is already stripped upstream, but be safe.
        out.push({ kind: "text", value: (t as Tokens.HTML).text });
        break;
      }
      default: {
        const raw = (t as { raw?: string }).raw;
        if (raw) out.push({ kind: "text", value: raw });
      }
    }
  }
  return out;
};

export const parseMarkdownBlocks = (md: string): Block[] => {
  const tokens = marked.lexer(md);
  const blocks: Block[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const ht = token as Tokens.Heading;
        const level = (Math.min(Math.max(ht.depth, 1), 3) as 1 | 2 | 3);
        blocks.push({
          kind: "heading",
          level,
          children: walkInline(ht.tokens ?? []),
        });
        break;
      }
      case "paragraph": {
        const pt = token as Tokens.Paragraph;
        blocks.push({
          kind: "paragraph",
          children: walkInline(pt.tokens ?? []),
        });
        break;
      }
      case "list": {
        const lt = token as Tokens.List;
        const start =
          typeof lt.start === "number" && lt.start > 0 ? lt.start : 1;
        lt.items.forEach((item, idx) => {
          const inlineTokens: Tokens.Generic[] = [];
          for (const child of item.tokens ?? []) {
            if (child.type === "text") {
              const tt = child as Tokens.Text;
              if (tt.tokens && tt.tokens.length > 0) {
                inlineTokens.push(...tt.tokens);
              } else {
                inlineTokens.push(child);
              }
            } else if (child.type === "paragraph") {
              inlineTokens.push(...((child as Tokens.Paragraph).tokens ?? []));
            }
          }
          blocks.push({
            kind: lt.ordered ? "orderedItem" : "paragraph",
            ...(lt.ordered ? { number: start + idx } : {}),
            children: walkInline(inlineTokens),
          } as Block);
        });
        break;
      }
      case "space":
      case "hr":
        break;
      default: {
        const raw = (token as { raw?: string }).raw?.trim();
        if (raw) {
          blocks.push({
            kind: "paragraph",
            children: [{ kind: "text", value: raw }],
          });
        }
      }
    }
  }

  return blocks;
};

export const inlineToPlainText = (children: Inline[]): string => {
  let s = "";
  for (const c of children) {
    if (c.kind === "text") s += c.value;
    else s += inlineToPlainText(c.children);
  }
  return s;
};
