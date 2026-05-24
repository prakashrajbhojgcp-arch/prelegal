import type { AnyTemplateSpec, TemplateSpec } from "./types";

import { spec as aiAddendumSpec } from "./ai-addendum/spec";
import { spec as baaSpec } from "./baa/spec";
import { spec as csaSpec } from "./csa/spec";
import { spec as designPartnerSpec } from "./design-partner/spec";
import { spec as dpaSpec } from "./dpa/spec";
import { spec as mutualNdaSpec } from "./mutual-nda/spec";
import { spec as mutualNdaCoverpageSpec } from "./mutual-nda-coverpage/spec";
import { spec as partnershipSpec } from "./partnership/spec";
import { spec as pilotSpec } from "./pilot/spec";
import { spec as psaSpec } from "./psa/spec";
import { spec as slaSpec } from "./sla/spec";
import { spec as softwareLicenseSpec } from "./software-license/spec";

// Ordered the same way the dashboard catalog (config.json) lists them.
const ALL_SPECS: AnyTemplateSpec[] = [
  mutualNdaSpec as AnyTemplateSpec,
  mutualNdaCoverpageSpec as AnyTemplateSpec,
  csaSpec as AnyTemplateSpec,
  designPartnerSpec as AnyTemplateSpec,
  slaSpec as AnyTemplateSpec,
  psaSpec as AnyTemplateSpec,
  dpaSpec as AnyTemplateSpec,
  softwareLicenseSpec as AnyTemplateSpec,
  partnershipSpec as AnyTemplateSpec,
  pilotSpec as AnyTemplateSpec,
  baaSpec as AnyTemplateSpec,
  aiAddendumSpec as AnyTemplateSpec,
];

const REGISTRY = new Map(ALL_SPECS.map((s) => [s.slug, s]));

/** Returns the spec for `slug`, or `null` if no template is registered. */
export function getTemplateSpec(slug: string): AnyTemplateSpec | null {
  return REGISTRY.get(slug) ?? null;
}

/** All registered template specs, in catalog order. */
export function allTemplateSpecs(): AnyTemplateSpec[] {
  return ALL_SPECS;
}

/**
 * Same as `getTemplateSpec` but with the `Data` generic preserved. Used by
 * per-template route pages that know their own data shape.
 */
export function specFor<Data>(slug: string): TemplateSpec<Data> | null {
  return (REGISTRY.get(slug) as TemplateSpec<Data> | undefined) ?? null;
}
