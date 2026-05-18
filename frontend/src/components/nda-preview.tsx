"use client";

import ReactMarkdown from "react-markdown";
import { formatDate, pluralYears } from "@/lib/format";
import type { NdaData } from "@/lib/nda-schema";
import { cn } from "@/lib/utils";

type Props = {
  value: NdaData;
  standardTerms: string;
};

const placeholder = (s: string, fallback: string) =>
  s.trim() ? s : fallback;

export function NdaPreview({ value, standardTerms }: Props) {
  const mndaTermText =
    value.mndaTerm.kind === "years"
      ? `Expires ${pluralYears(value.mndaTerm.years)} from the Effective Date.`
      : "Continues until terminated in accordance with the terms of the MNDA.";

  const confTermText =
    value.confidentialityTerm.kind === "years"
      ? `${pluralYears(value.confidentialityTerm.years)} from the Effective Date, but in the case of trade secrets until the Confidential Information is no longer considered a trade secret under applicable laws.`
      : "In perpetuity.";

  return (
    <article
      id="nda-preview"
      className="nda-document mx-auto max-w-3xl bg-white px-10 py-12 text-slate-900 shadow-sm"
    >
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Mutual Non-Disclosure Agreement
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This MNDA consists of this Cover Page and the Common Paper Mutual NDA
          Standard Terms Version 1.0.
        </p>
      </header>

      <section className="space-y-6">
        <CoverField label="Purpose">
          <p>{placeholder(value.purpose, "[Describe the purpose]")}</p>
        </CoverField>

        <CoverField label="Effective Date">
          <p>{placeholder(formatDate(value.effectiveDate), "[Date]")}</p>
        </CoverField>

        <CoverField label="MNDA Term">
          <p>{mndaTermText}</p>
        </CoverField>

        <CoverField label="Term of Confidentiality">
          <p>{confTermText}</p>
        </CoverField>

        <CoverField label="Governing Law & Jurisdiction">
          <p>
            Governing Law:{" "}
            <span>{placeholder(value.governingLaw, "[Fill in state]")}</span>
          </p>
          <p>
            Jurisdiction:{" "}
            <span>
              {placeholder(
                value.jurisdiction,
                "[Fill in city or county and state]",
              )}
            </span>
          </p>
        </CoverField>

        <CoverField label="MNDA Modifications">
          <p className="whitespace-pre-wrap">
            {placeholder(value.modifications, "None.")}
          </p>
        </CoverField>
      </section>

      <p className="mt-10 text-sm">
        By signing this Cover Page, each party agrees to enter into this MNDA as
        of the Effective Date.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-1/3 border border-slate-300 bg-slate-50 px-3 py-2 text-left font-semibold"></th>
              <th className="w-1/3 border border-slate-300 bg-slate-50 px-3 py-2 text-left font-semibold">
                Party 1
              </th>
              <th className="w-1/3 border border-slate-300 bg-slate-50 px-3 py-2 text-left font-semibold">
                Party 2
              </th>
            </tr>
          </thead>
          <tbody>
            <SignatureRow
              label="Company"
              p1={value.party1.company}
              p2={value.party2.company}
            />
            <SignatureRow
              label="Print Name"
              p1={value.party1.name}
              p2={value.party2.name}
            />
            <SignatureRow
              label="Title"
              p1={value.party1.title}
              p2={value.party2.title}
            />
            <SignatureRow
              label="Notice Address"
              p1={value.party1.noticeAddress}
              p2={value.party2.noticeAddress}
              multiline
            />
            <SignatureRow
              label="Date"
              p1={formatDate(value.party1.date)}
              p2={formatDate(value.party2.date)}
            />
            <tr>
              <td className="border border-slate-300 px-3 py-2 font-medium">
                Signature
              </td>
              <td className="h-16 border border-slate-300 px-3 py-2"></td>
              <td className="h-16 border border-slate-300 px-3 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <hr className="my-10 border-slate-200" />

      <section className="nda-standard-terms">
        <ReactMarkdown>{standardTerms}</ReactMarkdown>
      </section>
    </article>
  );
}

function CoverField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </h2>
      <div className="mt-1 text-base leading-relaxed">{children}</div>
    </div>
  );
}

function SignatureRow({
  label,
  p1,
  p2,
  multiline,
}: {
  label: string;
  p1: string;
  p2: string;
  multiline?: boolean;
}) {
  const cellCx = cn(
    "border border-slate-300 px-3 py-2 align-top",
    multiline && "whitespace-pre-wrap",
  );
  return (
    <tr>
      <td className="border border-slate-300 px-3 py-2 font-medium">
        {label}
      </td>
      <td className={cellCx}>{p1 || <span className="text-slate-300">—</span>}</td>
      <td className={cellCx}>{p2 || <span className="text-slate-300">—</span>}</td>
    </tr>
  );
}
