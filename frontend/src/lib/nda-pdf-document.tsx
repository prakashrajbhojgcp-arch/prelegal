import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { formatDate, pluralYears } from "./format";
import type { Block, Inline } from "./markdown-blocks";
import type { NdaData, Party } from "./nda-schema";

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
    width: "22%",
    flex: 0,
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
  listRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
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

const placeholderText = (value: string, fallback: string) =>
  value.trim() ? (
    <Text style={styles.fieldBody}>{value}</Text>
  ) : (
    <Text style={[styles.fieldBody, styles.placeholder]}>{fallback}</Text>
  );

const SignatureRow = ({
  label,
  p1,
  p2,
}: {
  label: string;
  p1: string;
  p2: string;
}) => (
  <View style={styles.row} wrap={false}>
    <Text style={[styles.cell, styles.cellLabel]}>{label}</Text>
    <Text style={styles.cell}>{p1 || " "}</Text>
    <Text style={styles.cell}>{p2 || " "}</Text>
  </View>
);

const partyDate = (p: Party) => formatDate(p.date);

const mndaTermText = (data: NdaData) =>
  data.mndaTerm.kind === "years"
    ? `Expires ${pluralYears(data.mndaTerm.years)} from the Effective Date.`
    : "Continues until terminated in accordance with the terms of the MNDA.";

const confTermText = (data: NdaData) =>
  data.confidentialityTerm.kind === "years"
    ? `${pluralYears(data.confidentialityTerm.years)} from the Effective Date, but in the case of trade secrets until the Confidential Information is no longer considered a trade secret under applicable laws.`
    : "In perpetuity.";

type Props = {
  data: NdaData;
  standardTermsBlocks: Block[];
};

export const NdaPdfDocument = ({ data, standardTermsBlocks }: Props) => (
  <Document
    title="Mutual NDA"
    author={data.party1.company || data.party2.company || "Mutual NDA Creator"}
    subject="Common Paper Mutual Non-Disclosure Agreement v1.0"
    creator="Mutual NDA Creator"
    producer="Mutual NDA Creator"
  >
    <Page size="LETTER" style={styles.page} wrap>
      <Text style={styles.title}>Mutual Non-Disclosure Agreement</Text>
      <Text style={styles.subtitle}>
        This MNDA consists of this Cover Page and the Common Paper Mutual NDA
        Standard Terms Version 1.0.
      </Text>

      <CoverField label="Purpose">
        {placeholderText(data.purpose, "[Describe the purpose]")}
      </CoverField>
      <CoverField label="Effective Date">
        {placeholderText(formatDate(data.effectiveDate), "[Date]")}
      </CoverField>
      <CoverField label="MNDA Term">
        <Text style={styles.fieldBody}>{mndaTermText(data)}</Text>
      </CoverField>
      <CoverField label="Term of Confidentiality">
        <Text style={styles.fieldBody}>{confTermText(data)}</Text>
      </CoverField>
      <CoverField label="Governing Law & Jurisdiction">
        <Text style={styles.fieldBody}>
          <Text style={styles.bold}>Governing Law: </Text>
          {data.governingLaw.trim() || (
            <Text style={styles.placeholder}>[Fill in state]</Text>
          )}
        </Text>
        <Text style={styles.fieldBody}>
          <Text style={styles.bold}>Jurisdiction: </Text>
          {data.jurisdiction.trim() || (
            <Text style={styles.placeholder}>
              [Fill in city or county and state]
            </Text>
          )}
        </Text>
      </CoverField>
      <CoverField label="MNDA Modifications">
        {placeholderText(data.modifications, "None.")}
      </CoverField>

      <View style={styles.signatureSpacer}>
        <Text style={styles.signatureIntro}>
          By signing this Cover Page, each party agrees to enter into this MNDA
          as of the Effective Date.
        </Text>
        <View style={styles.table}>
          <View style={styles.row} wrap={false}>
            <Text style={[styles.cell, styles.cellLabel]}> </Text>
            <Text style={[styles.cell, styles.cellHeader]}>Party 1</Text>
            <Text style={[styles.cell, styles.cellHeader]}>Party 2</Text>
          </View>
          <SignatureRow
            label="Company"
            p1={data.party1.company}
            p2={data.party2.company}
          />
          <SignatureRow
            label="Print Name"
            p1={data.party1.name}
            p2={data.party2.name}
          />
          <SignatureRow
            label="Title"
            p1={data.party1.title}
            p2={data.party2.title}
          />
          <SignatureRow
            label="Notice Address"
            p1={data.party1.noticeAddress}
            p2={data.party2.noticeAddress}
          />
          <SignatureRow
            label="Date"
            p1={partyDate(data.party1)}
            p2={partyDate(data.party2)}
          />
          <View style={styles.row} wrap={false}>
            <Text style={[styles.cell, styles.cellLabel]}>Signature</Text>
            <Text style={[styles.cell, styles.cellSig]}> </Text>
            <Text style={[styles.cell, styles.cellSig]}> </Text>
          </View>
        </View>
      </View>

      <View style={styles.rule} />

      <View>{standardTermsBlocks.map((b, i) => renderBlock(b, i))}</View>
    </Page>
  </Document>
);
