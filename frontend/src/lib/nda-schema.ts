import { todayIso } from "./format";

export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
  date: string;
};

export type MndaTerm =
  | { kind: "years"; years: number }
  | { kind: "untilTerminated" };

export type ConfidentialityTerm =
  | { kind: "years"; years: number }
  | { kind: "perpetuity" };

export type NdaData = {
  purpose: string;
  effectiveDate: string;
  mndaTerm: MndaTerm;
  confidentialityTerm: ConfidentialityTerm;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
};

export const DEFAULT_PURPOSE =
  "Evaluating whether to enter into a business relationship with the other party.";

export const emptyParty = (): Party => ({
  name: "",
  title: "",
  company: "",
  noticeAddress: "",
  date: todayIso(),
});

export const defaultNdaData = (): NdaData => ({
  purpose: DEFAULT_PURPOSE,
  effectiveDate: todayIso(),
  mndaTerm: { kind: "years", years: 1 },
  confidentialityTerm: { kind: "years", years: 1 },
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: emptyParty(),
  party2: emptyParty(),
});
