import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { formatDate } from "../../format";
import type { Block, Inline } from "../../markdown-blocks";
import type { FieldDef, GenericData } from "./schema";

const palette = {
  ink: "#0f172a",
  muted: "#475569",
  faint: "#94a3b8",
  rule: "#cbd5e1",
  cellHeader: "#f1f5f9",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: palette.ink,
    lineHeight: 1.5,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: palette.muted,
    marginBottom: 22,
  },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: palette.muted,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  fieldBody: { fontSize: 11 },
  signatureSpacer: { marginTop: 12 },
  signatureIntro: { fontSize: 10.5, marginBottom: 10 },
  table: {
    borderWidth: 1,
    borderColor: palette.rule,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  row: { flexDirection: "row" },
  cell: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.rule,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 10,
  },
  cellLabel: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "22%",
    fontFamily: "Helvetica-Bold",
    backgroundColor: palette.cellHeader,
  },
  cellHeader: {
    fontFamily: "Helvetica-Bold",
    backgroundColor: palette.cellHeader,
  },
  cellSig: { minHeight: 42 },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
    marginVertical: 22,
  },
  termsHeading1: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    marginBottom: 12,
  },
  termsHeading2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12.5,
    marginTop: 12,
    marginBottom: 6,
  },
  termsHeading3: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: { fontSize: 10.5, marginBottom: 8, textAlign: "justify" },
  listRow: { flexDirection: "row", marginBottom: 8 },
  listNumber: { width: 22, fontSize: 10.5 },
  listBody: { flex: 1, fontSize: 10.5, textAlign: "justify" },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Helvetica-Oblique" },
  boldItalic: { fontFamily: "Helvetica-BoldOblique" },
  linkText: { color: "#1d4ed8", textDecoration: "underline" },
  placeholder: { color: palette.faint },
});

type InlineCtx = { bold?: boolean; italic?: boolean };

const inlineStyle = ({ bold, italic }: InlineCtx) =>
  bold && italic
    ? styles.boldItalic
    : bold
      ? styles.bold
      : italic
        ? styles.italic
        : undefined;

const renderInline = (
  nodes: Inline[],
  ctx: InlineCtx = {},
): ReactElement[] => {
  const out: ReactElement[] = [];
  nodes.forEach((node, idx) => {
    const key = `${idx}`;
    if (node.kind === "text") {
      out.push(
        <Text key={key} style={inlineStyle(ctx)}>
          {node.value}
        </Text>,
      );
    } else if (node.kind === "bold") {
      out.push(
        <Text key={key}>{renderInline(node.children, { ...ctx, bold: true })}</Text>,
      );
    } else if (node.kind === "italic") {
      out.push(
        <Text key={key}>
          {renderInline(node.children, { ...ctx, italic: true })}
        </Text>,
      );
    } else {
      out.push(
        <Link key={key} src={node.href} style={styles.linkText}>
          {renderInline(node.children, ctx)}
        </Link>,
      );
    }
  });
  return out;
};

const renderBlock = (block: Block, idx: number): ReactElement => {
  const key = `b-${idx}`;
  if (block.kind === "heading") {
    const style =
      block.level === 1
        ? styles.termsHeading1
        : block.level === 2
          ? styles.termsHeading2
          : styles.termsHeading3;
    return (
      <Text key={key} style={style}>
        {renderInline(block.children)}
      </Text>
    );
  }
  if (block.kind === "paragraph") {
    return (
      <Text key={key} style={styles.paragraph}>
        {renderInline(block.children)}
      </Text>
    );
  }
  return (
    <View key={key} style={styles.listRow} wrap={false}>
      <Text style={styles.listNumber}>{block.number}.</Text>
      <Text style={styles.listBody}>{renderInline(block.children)}</Text>
    </View>
  );
};

const CoverField = ({
  label,
  children,
}: {
  label: string;
  children: ReactElement | ReactElement[];
}) => (
  <View style={styles.fieldGroup} wrap={false}>
    <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
    {children}
  </View>
);

const isDateField = (key: string): boolean => /date/i.test(key);

const placeholderText = (raw: string | undefined, key: string) => {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return <Text style={[styles.fieldBody, styles.placeholder]}>—</Text>;
  }
  return (
    <Text style={styles.fieldBody}>
      {isDateField(key) ? formatDate(trimmed) : trimmed}
    </Text>
  );
};

const SignatureRow = ({
  label,
  parties,
  field,
  transform,
}: {
  label: string;
  parties: GenericData["parties"];
  field: keyof GenericData["parties"][number];
  transform?: (s: string) => string;
}) => (
  <View style={styles.row} wrap={false}>
    <Text style={[styles.cell, styles.cellLabel]}>{label}</Text>
    {parties.map((p, index) => {
      const raw = p[field] ?? "";
      const display = raw && transform ? transform(raw) : raw;
      return (
        <Text key={index} style={styles.cell}>
          {display || " "}
        </Text>
      );
    })}
  </View>
);

type Props = {
  name: string;
  manifest: FieldDef[];
  data: GenericData;
  standardTermsBlocks: Block[];
};

export const GenericPdfDocument = ({
  name,
  manifest,
  data,
  standardTermsBlocks,
}: Props) => (
  <Document
    title={name}
    author={data.parties[0]?.company || `${name} Creator`}
    subject={name}
    creator={`${name} Creator`}
    producer={`${name} Creator`}
  >
    <Page size="LETTER" style={styles.page} wrap>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.subtitle}>
        This {name} consists of this Cover Page and the standard terms below.
      </Text>

      {manifest.map((field) => (
        <CoverField key={field.key} label={field.label}>
          {placeholderText(data.fields[field.key], field.key)}
        </CoverField>
      ))}

      <View style={styles.signatureSpacer}>
        <Text style={styles.signatureIntro}>
          By signing this Cover Page, each party agrees to enter into this
          {" "}{name} as of the Effective Date.
        </Text>
        <View style={styles.table}>
          <View style={styles.row} wrap={false}>
            <Text style={[styles.cell, styles.cellLabel]}> </Text>
            {data.parties.map((_, index) => (
              <Text
                key={index}
                style={[styles.cell, styles.cellHeader]}
              >
                Party {index + 1}
              </Text>
            ))}
          </View>
          <SignatureRow
            label="Company"
            parties={data.parties}
            field="company"
          />
          <SignatureRow
            label="Print Name"
            parties={data.parties}
            field="name"
          />
          <SignatureRow label="Title" parties={data.parties} field="title" />
          <SignatureRow
            label="Notice Address"
            parties={data.parties}
            field="noticeAddress"
          />
          <SignatureRow
            label="Date"
            parties={data.parties}
            field="date"
            transform={formatDate}
          />
          <View style={styles.row} wrap={false}>
            <Text style={[styles.cell, styles.cellLabel]}>Signature</Text>
            {data.parties.map((_, index) => (
              <Text key={index} style={[styles.cell, styles.cellSig]}>
                {" "}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.rule} />

      <View>{standardTermsBlocks.map((b, i) => renderBlock(b, i))}</View>
    </Page>
  </Document>
);
