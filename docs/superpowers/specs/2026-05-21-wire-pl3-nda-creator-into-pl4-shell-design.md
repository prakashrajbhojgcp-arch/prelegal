# Wire PL-3 Mutual NDA creator into the PL-4 shell

**Status:** Draft
**Date:** 2026-05-21
**Branch:** PL-4-v1-foundation (work continues here unless we split to PL-5)

## Background

PL-3 (commits `23187e6`, `b2b0e3c`) shipped a single-page Mutual NDA creator at `/`. PL-4 (commit `8d84e54`) introduced the V1 product foundation — login, dashboard shell (sidebar + topbar), and a templates dashboard where every entry is a disabled "Coming soon" card. As part of PL-4, the home route was repointed: `frontend/src/app/page.tsx` now redirects `/` to `/dashboard`, and `nda-app.tsx` was deliberately left in the tree but unrouted, with a header comment noting that re-integration would land in a later ticket.

This spec covers that re-integration: making the existing Mutual NDA creator reachable from the dashboard, hosted inside the PL-4 shell, without changing the backend or the other templates' "Coming soon" state.

## Goals

- A signed-in user can click the Mutual NDA card on `/dashboard` and land on a working NDA creator at `/dashboard/templates/mutual-nda`.
- The creator runs inside the dashboard shell (sidebar + topbar visible), with chrome that matches the existing dashboard page rather than duplicating it.
- PDF download keeps working exactly as it does in the parked component (client-side via `@react-pdf/renderer`, file name `Mutual-NDA-<Party1>-<Party2>.pdf`).
- The PL-4 auth gate and middleware continue to protect the route.

## Non-goals

- Wiring any other template (CSA, SLA, PSA, DPA, etc.) to a creator. They stay disabled "Coming soon".
- Server-side PDF generation, AI-assisted drafting, or any document persistence.
- Adding a "Documents" item to the sidebar nav (still "Soon" per PL-4).
- Real authentication or per-user document storage.
- Changing the catalog schema in `config.json` or the `/api/templates` payload.

## Architecture

### Routing & data flow

```
GET /dashboard/templates/mutual-nda
  └─ dashboard/layout.tsx               (auth gate → /login if no session)
      └─ dashboard/templates/mutual-nda/page.tsx   (server component)
          ├─ loadStandardTerms()             ← reads templates/Mutual-NDA.md
          ├─ loadStandardTermsBlocks()       ← parsed markdown blocks for PDF
          └─ <NdaApp standardTerms standardTermsBlocks />   (client)
              ├─ <NdaForm />                 ← controlled form state
              ├─ <NdaPreview />              ← live preview from state
              └─ Download PDF                ← @react-pdf/renderer in browser
```

`loadStandardTerms` and `loadStandardTermsBlocks` already exist in `frontend/src/lib/templates.ts` and read from `process.cwd()/../templates`. The Next.js standalone build (`next.config.ts` → `outputFileTracingIncludes`) already bundles the `templates/` directory, so no build config changes are needed.

### Auth

The new page lives under `/dashboard/...`, so:
- The existing `frontend/src/middleware.ts` matcher (`/dashboard/:path*`) gates the route at the edge.
- The existing `dashboard/layout.tsx` calls `getCurrentUser()` and redirects to `/login` on miss.

No additional auth wiring is required.

## Component design

### `frontend/src/app/dashboard/templates/mutual-nda/page.tsx` (new)

Server component. Loads the template, hands it to `NdaApp`. No `metadata` override needed — inherits "Dashboard · Prelegal" from the dashboard layout (acceptable for V1).

```tsx
import { NdaApp } from "@/components/nda-app";
import { loadStandardTerms, loadStandardTermsBlocks } from "@/lib/templates";

export default async function MutualNdaPage() {
  const standardTerms = loadStandardTerms();
  const standardTermsBlocks = loadStandardTermsBlocks();
  return (
    <NdaApp
      standardTerms={standardTerms}
      standardTermsBlocks={standardTermsBlocks}
    />
  );
}
```

### `frontend/src/components/nda-app.tsx` (refactor)

The current component renders its own full-page chrome (`min-h-screen bg-slate-100`, sticky header with title and Download button). All of that needs to come off so it can sit inside the dashboard layout's `<main>`.

Changes:
1. Delete the parked-component comment at the top of the file.
2. Replace the outer `<div className="min-h-screen bg-slate-100">` with a fragment / plain `<div className="space-y-8">` matching the spacing of `/dashboard/page.tsx`.
3. Replace the sticky `<header>` with a dashboard-style page header:
   - `<h1 className="text-2xl font-semibold tracking-tight text-brand-navy">Mutual NDA Creator</h1>`
   - `<p className="mt-1 text-sm text-brand-gray">Common Paper Mutual NDA, Version 1.0 — fill in the details to generate a downloadable agreement.</p>`
   - Right-side: the Download PDF button, restyled to use **brand-purple** (`bg-brand-purple` per the project color scheme — submit buttons are purple) instead of `bg-slate-900`. Keep the `disabled` + "Generating…" states and the `role="alert"` error message.
4. Replace the two-column `<main className="... max-w-7xl ... grid-cols-[minmax(0,420px)_minmax(0,1fr)]">` with a body that fits the dashboard's `max-w-6xl` container:
   - `grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]`
   - Drop the outer `max-w-7xl mx-auto px-6` — the dashboard layout's `<main>` already supplies the width cap and horizontal padding.
5. Keep `NdaForm`, `NdaPreview`, the `useState<NdaData>`, the `handleDownload` callback, the `buildPdfFileName` helper, the `triggerBlobDownload` helper, and the `data-testid="download-pdf"` attribute — all unchanged.

The component stays a client component (`"use client"`). Props signature is unchanged so the server page wires up identically.

### `frontend/src/components/template-card.tsx` (edit)

Currently every card is identical and disabled. Update so the Mutual NDA card becomes a link, others stay as they are.

Behavior:
- If `template.filename === "Mutual-NDA.md"`:
  - Wrap the card body in a Next `<Link href="/dashboard/templates/mutual-nda">` so the whole card is the click target.
  - Change the badge from `Coming soon` (brand-yellow) to `Available` in **brand-blue** (`text-brand-blue`).
  - Change the `<button disabled>` to a styled `<span>` reading `Create →` in **brand-purple** (matches the "submit button" role from the color scheme), not a disabled button.
  - Add hover affordance (`hover:ring-brand-blue/40` or similar) to communicate clickability.
- Else (every other template):
  - Render exactly as today — disabled button, "Coming soon" badge, no link.

The Mutual NDA branch is a single special case in this component. We accept the minor duplication rather than adding a `route` or `available` field to the catalog response. Once a second template becomes available, we'll revisit and put the routing concern in the catalog (out of scope here).

### `frontend/src/app/dashboard/page.tsx` (no changes)

It already maps over `catalog.templates` and renders `<TemplateCard />` for each. The behavior change is entirely inside `TemplateCard`.

## Testing

### Unit tests (vitest)

No changes required to the existing PL-3 unit tests — they test `format.ts`, `markdown-blocks.ts`, `nda-schema.ts`, and `nda-pdf-document.tsx` and don't touch routing.

### End-to-end tests (Playwright)

Two changes:

1. **`frontend/e2e/download-pdf.spec.ts` (edit).** This spec currently hits `/` and exercises the PDF download. Rewrite it to:
   - Start at `/login`, fill in any email + name, submit.
   - On `/dashboard`, click the Mutual NDA card (it should now be a link).
   - On `/dashboard/templates/mutual-nda`, fill the minimum required fields.
   - Click the `data-testid="download-pdf"` button.
   - Assert the download fires and the file name matches the expected pattern.

   Mirror the login flow already used by `frontend/e2e/login-dashboard.spec.ts` to stay consistent.

2. **`frontend/e2e/login-dashboard.spec.ts` (extend, optional but recommended).** Add an assertion that the **`Mutual NDA`** card (the standalone agreement, not `Mutual NDA - Cover Page`) is a clickable link — match by exact accessible name or by `href="/dashboard/templates/mutual-nda"` rather than a substring regex, since the catalog also contains a "Mutual NDA - Cover Page" entry that must remain disabled. Also assert at least one other card (e.g., `CSA`) is *not* a link. Cheap regression guard against accidentally making every card clickable in a later refactor.

No backend test changes — the FastAPI `/api/templates` payload is unchanged.

## Error handling

Inherits PL-3's behavior:
- PDF generation failure: caught in `handleDownload`, status flips to `error`, the existing `role="alert"` paragraph renders below the button.
- Missing template file: server-side `fs.readFileSync` throws at request time, Next renders the default error page. Acceptable — the file is bundled into the standalone output, so this only happens on a broken deploy, and the existing `frontend/CLAUDE.md` already documents `outputFileTracingIncludes`.
- Auth: handled by middleware + layout, unchanged.

## Color scheme

Per `frontend/CLAUDE.md`:
- Accent yellow `#ecad0a` — keep on "Coming soon" badges for the other templates.
- Brand blue `#209dd7` — already used for accents; OK for the "Available" badge on Mutual NDA.
- Brand purple `#753991` — **submit buttons**. The Download PDF button on the creator and the "Create →" affordance on the Mutual NDA card both use this.
- Brand navy `#032147` — headings (page header on the creator).
- Brand gray `#888888` — subtitle text.

## Files changed

| File | Change |
|---|---|
| `frontend/src/app/dashboard/templates/mutual-nda/page.tsx` | **new** — server page that loads the template and renders `<NdaApp />` |
| `frontend/src/components/nda-app.tsx` | **edit** — strip outer chrome, restyle header to match dashboard, narrower form column, brand-purple Download button |
| `frontend/src/components/template-card.tsx` | **edit** — Mutual NDA card becomes a link with "Create →" affordance; others unchanged |
| `frontend/e2e/download-pdf.spec.ts` | **edit** — login → navigate → download flow |
| `frontend/e2e/login-dashboard.spec.ts` | **edit (optional)** — assert link/disabled split across cards |

No other files are touched. Backend (`backend/src/prelegal_backend/*`), Docker, scripts, and the catalog (`config.json`, `/api/templates`) are all unchanged.

## Open questions

None at spec time. If the brand-purple "Create →" affordance on the card feels too loud during implementation, we'll fall back to brand-blue and confirm before merging.
