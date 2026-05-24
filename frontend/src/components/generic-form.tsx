"use client";

import { cn } from "@/lib/utils";
import type {
  FieldDef,
  GenericData,
  Party,
} from "@/lib/templates/generic/schema";

type Props = {
  manifest: FieldDef[];
  value: GenericData;
  onChange: (next: GenericData) => void;
};

const inputCx = cn(
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2",
  "text-sm text-slate-900 placeholder:text-slate-400",
  "focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500",
);

const textareaCx = cn(inputCx, "min-h-[72px] resize-y");

const isDateField = (key: string): boolean =>
  /date/i.test(key);

const isLongTextField = (key: string): boolean =>
  /(services|restrictions|scope|criteria|deliverables|obligations|exclusions|limitations|use|conversion|aiFeatures|natureOfProcessing|categoriesOfData|categoriesOfDataSubjects|modifications)/i.test(
    key,
  );

export function GenericForm({ manifest, value, onChange }: Props) {
  const updateField = (key: string, next: string) =>
    onChange({ ...value, fields: { ...value.fields, [key]: next } });

  const updateParty = (index: number, patch: Partial<Party>) => {
    const parties = value.parties.map((p, i) =>
      i === index ? { ...p, ...patch } : p,
    );
    onChange({ ...value, parties });
  };

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => e.preventDefault()}
      aria-label="Template details"
    >
      <Section title="Agreement details">
        {manifest.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            hint={field.description}
            htmlFor={`field-${field.key}`}
          >
            {isLongTextField(field.key) ? (
              <textarea
                id={`field-${field.key}`}
                className={textareaCx}
                value={value.fields[field.key] ?? ""}
                onChange={(e) => updateField(field.key, e.target.value)}
              />
            ) : isDateField(field.key) ? (
              <input
                id={`field-${field.key}`}
                type="date"
                className={inputCx}
                value={value.fields[field.key] ?? ""}
                onChange={(e) => updateField(field.key, e.target.value)}
              />
            ) : (
              <input
                id={`field-${field.key}`}
                className={inputCx}
                value={value.fields[field.key] ?? ""}
                onChange={(e) => updateField(field.key, e.target.value)}
              />
            )}
          </Field>
        ))}
      </Section>

      {value.parties.map((party, index) => (
        <Section key={index} title={`Party ${index + 1}`}>
          <PartyFields
            idPrefix={`party-${index}`}
            value={party}
            onChange={(patch) => updateParty(index, patch)}
          />
        </Section>
      ))}
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-base font-semibold text-slate-900">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-slate-900"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function PartyFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: Party;
  onChange: (patch: Partial<Party>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Company" htmlFor={`${idPrefix}-company`}>
        <input
          id={`${idPrefix}-company`}
          className={inputCx}
          value={value.company}
          onChange={(e) => onChange({ company: e.target.value })}
        />
      </Field>
      <Field label="Print Name" htmlFor={`${idPrefix}-name`}>
        <input
          id={`${idPrefix}-name`}
          className={inputCx}
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <Field label="Title" htmlFor={`${idPrefix}-title`}>
        <input
          id={`${idPrefix}-title`}
          className={inputCx}
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Date" htmlFor={`${idPrefix}-date`}>
        <input
          id={`${idPrefix}-date`}
          type="date"
          className={inputCx}
          value={value.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="Notice Address"
          hint="Email or postal address."
          htmlFor={`${idPrefix}-address`}
        >
          <textarea
            id={`${idPrefix}-address`}
            className={textareaCx}
            value={value.noticeAddress}
            onChange={(e) => onChange({ noticeAddress: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
