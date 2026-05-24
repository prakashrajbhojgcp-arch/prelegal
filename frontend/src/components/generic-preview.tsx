"use client";

import ReactMarkdown from "react-markdown";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  FieldDef,
  GenericData,
} from "@/lib/templates/generic/schema";

type Props = {
  name: string;
  manifest: FieldDef[];
  value: GenericData;
  standardTerms: string;
};

const labelCx = "text-[10px] uppercase tracking-wider text-brand-gray";
const valueCx = "text-sm text-slate-900";
const placeholderCx = cn(valueCx, "text-slate-400");

const isDateField = (key: string): boolean => /date/i.test(key);

const isEmpty = (s: string | undefined): s is undefined | "" =>
  s === undefined || s.trim() === "";

const renderValue = (key: string, raw: string | undefined) => {
  if (isEmpty(raw)) {
    return <span className={placeholderCx}>—</span>;
  }
  const display = isDateField(key) ? formatDate(raw) : raw;
  return <span className={valueCx}>{display}</span>;
};

export function GenericPreview({
  name,
  manifest,
  value,
  standardTerms,
}: Props) {
  return (
    <article className="space-y-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <header>
        <h2 className="text-xl font-semibold text-brand-navy">{name}</h2>
        <p className="mt-1 text-sm text-brand-gray">
          Cover Page · live preview
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {manifest.map((field) => (
          <div key={field.key}>
            <p className={labelCx}>{field.label}</p>
            <p className="mt-1">
              {renderValue(field.key, value.fields[field.key])}
            </p>
          </div>
        ))}
      </section>

      <section>
        <table className="w-full table-fixed border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-[22%] bg-slate-100 px-2 py-2 text-left font-semibold text-slate-700">
                {" "}
              </th>
              {value.parties.map((_, index) => (
                <th
                  key={index}
                  className="bg-slate-100 px-2 py-2 text-left font-semibold text-slate-700"
                >
                  Party {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <PartyRow label="Company" parties={value.parties} field="company" />
            <PartyRow label="Print Name" parties={value.parties} field="name" />
            <PartyRow label="Title" parties={value.parties} field="title" />
            <PartyRow
              label="Notice Address"
              parties={value.parties}
              field="noticeAddress"
            />
            <PartyRow
              label="Date"
              parties={value.parties}
              field="date"
              transform={formatDate}
            />
          </tbody>
        </table>
      </section>

      <hr className="border-slate-200" />

      <section className="prose prose-sm max-w-none prose-headings:text-brand-navy">
        <ReactMarkdown>{standardTerms}</ReactMarkdown>
      </section>
    </article>
  );
}

function PartyRow({
  label,
  parties,
  field,
  transform,
}: {
  label: string;
  parties: GenericData["parties"];
  field: keyof GenericData["parties"][number];
  transform?: (s: string) => string;
}) {
  return (
    <tr>
      <td className="border-t border-slate-200 bg-slate-50 px-2 py-2 font-semibold text-slate-700">
        {label}
      </td>
      {parties.map((p, index) => {
        const raw = p[field] ?? "";
        const display = raw && transform ? transform(raw) : raw;
        return (
          <td
            key={index}
            className="border-t border-slate-200 px-2 py-2 align-top text-slate-900"
          >
            {display || <span className="text-slate-400">—</span>}
          </td>
        );
      })}
    </tr>
  );
}
