import { todayIso } from "../../format";

export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
  date: string;
};

export type GenericData = {
  fields: Record<string, string>;
  parties: Party[];
};

export type FieldDef = {
  /** camelCase key matching the backend manifest. */
  key: string;
  /** Human label used in forms and the cover-page PDF. */
  label: string;
  /** One-line hint shown under the label / fed to the LLM. */
  description: string;
};

export const emptyParty = (): Party => ({
  name: "",
  title: "",
  company: "",
  noticeAddress: "",
  date: todayIso(),
});

export const buildDefaultGenericData = (
  manifest: FieldDef[],
  numParties: number,
): (() => GenericData) => () => ({
  fields: Object.fromEntries(manifest.map((f) => [f.key, ""])),
  parties: Array.from({ length: numParties }, () => emptyParty()),
});
