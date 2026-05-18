"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { NdaData, Party } from "@/lib/nda-schema";

type FieldProps = {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
};

function Field({ label, hint, htmlFor, children }: FieldProps) {
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

const inputCx = cn(
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2",
  "text-sm text-slate-900 placeholder:text-slate-400",
  "focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500",
);

const textareaCx = cn(inputCx, "min-h-[72px] resize-y");

type Props = {
  value: NdaData;
  onChange: (next: NdaData) => void;
};

export function NdaForm({ value, onChange }: Props) {
  const update = <K extends keyof NdaData>(key: K, v: NdaData[K]) =>
    onChange({ ...value, [key]: v });

  const updateParty = (which: "party1" | "party2", patch: Partial<Party>) =>
    onChange({ ...value, [which]: { ...value[which], ...patch } });

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => e.preventDefault()}
      aria-label="Mutual NDA details"
    >
      <Section title="Agreement details">
        <Field
          label="Purpose"
          hint="How Confidential Information may be used."
          htmlFor="purpose"
        >
          <textarea
            id="purpose"
            className={textareaCx}
            value={value.purpose}
            onChange={(e) => update("purpose", e.target.value)}
          />
        </Field>

        <Field label="Effective Date" htmlFor="effectiveDate">
          <input
            id="effectiveDate"
            type="date"
            className={inputCx}
            value={value.effectiveDate}
            onChange={(e) => update("effectiveDate", e.target.value)}
          />
        </Field>

        <TermPicker
          name="mndaTerm"
          legend="MNDA Term"
          inYears={value.mndaTerm.kind === "years"}
          years={value.mndaTerm.kind === "years" ? value.mndaTerm.years : 1}
          yearsSuffix="year(s) from Effective Date"
          noExpiryLabel="Continues until terminated in accordance with the terms of the MNDA"
          onSelectYears={(years) => update("mndaTerm", { kind: "years", years })}
          onSelectNoExpiry={() =>
            update("mndaTerm", { kind: "untilTerminated" })
          }
        />

        <TermPicker
          name="confidentialityTerm"
          legend="Term of Confidentiality"
          inYears={value.confidentialityTerm.kind === "years"}
          years={
            value.confidentialityTerm.kind === "years"
              ? value.confidentialityTerm.years
              : 1
          }
          yearsSuffix="year(s) from Effective Date (trade secrets remain protected longer)"
          noExpiryLabel="In perpetuity"
          onSelectYears={(years) =>
            update("confidentialityTerm", { kind: "years", years })
          }
          onSelectNoExpiry={() =>
            update("confidentialityTerm", { kind: "perpetuity" })
          }
        />
      </Section>

      <Section title="Governing law & jurisdiction">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Governing Law (state)"
            hint="e.g. Delaware"
            htmlFor="governingLaw"
          >
            <input
              id="governingLaw"
              className={inputCx}
              value={value.governingLaw}
              onChange={(e) => update("governingLaw", e.target.value)}
              placeholder="State"
            />
          </Field>
          <Field
            label="Jurisdiction"
            hint='e.g. "New Castle, DE"'
            htmlFor="jurisdiction"
          >
            <input
              id="jurisdiction"
              className={inputCx}
              value={value.jurisdiction}
              onChange={(e) => update("jurisdiction", e.target.value)}
              placeholder="City or county and state"
            />
          </Field>
        </div>

        <Field
          label="Modifications (optional)"
          hint="List any modifications to the MNDA standard terms."
          htmlFor="modifications"
        >
          <textarea
            id="modifications"
            className={textareaCx}
            value={value.modifications}
            onChange={(e) => update("modifications", e.target.value)}
            placeholder="None"
          />
        </Field>
      </Section>

      <Section title="Party 1">
        <PartyFields
          idPrefix="party1"
          value={value.party1}
          onChange={(patch) => updateParty("party1", patch)}
        />
      </Section>

      <Section title="Party 2">
        <PartyFields
          idPrefix="party2"
          value={value.party2}
          onChange={(patch) => updateParty("party2", patch)}
        />
      </Section>
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

type TermPickerProps = {
  name: string;
  legend: string;
  inYears: boolean;
  years: number;
  yearsSuffix: string;
  noExpiryLabel: string;
  onSelectYears: (years: number) => void;
  onSelectNoExpiry: () => void;
};

function TermPicker({
  name,
  legend,
  inYears,
  years,
  yearsSuffix,
  noExpiryLabel,
  onSelectYears,
  onSelectNoExpiry,
}: TermPickerProps) {
  // Remember the last user-entered years so toggling to the no-expiry option
  // and back doesn't silently reset the value to 1.
  const lastYears = useRef(inYears ? years : 1);
  if (inYears) lastYears.current = years;

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-900">{legend}</legend>
      <label className="flex flex-wrap items-center gap-3 text-sm">
        <input
          type="radio"
          name={name}
          checked={inYears}
          onChange={() => onSelectYears(lastYears.current)}
          className="size-4"
        />
        <span>Expires</span>
        <input
          type="number"
          min={1}
          className={cn(inputCx, "w-20")}
          value={inYears ? years : lastYears.current}
          disabled={!inYears}
          onChange={(e) =>
            onSelectYears(Math.max(1, Number(e.target.value) || 1))
          }
        />
        <span>{yearsSuffix}</span>
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="radio"
          name={name}
          checked={!inYears}
          onChange={onSelectNoExpiry}
          className="size-4"
        />
        <span>{noExpiryLabel}</span>
      </label>
    </fieldset>
  );
}
