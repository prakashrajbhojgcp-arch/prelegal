# Wire PL-3 Mutual NDA creator into the PL-4 shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the parked PL-3 Mutual NDA creator reachable from the PL-4 dashboard at `/dashboard/templates/mutual-nda`, embedded inside the dashboard shell.

**Architecture:** Add a server-rendered Next.js route under the existing dashboard layout that loads `templates/Mutual-NDA.md` and renders the existing `NdaApp` client component. Refactor `NdaApp` to drop its own page chrome so it nests cleanly inside the dashboard's sidebar/topbar shell. Make only the Mutual NDA template card clickable; every other card stays disabled "Coming soon".

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, TypeScript, `@react-pdf/renderer` (client-side PDF), Playwright (e2e), Vitest (unit). Backend untouched.

**Spec:** `docs/superpowers/specs/2026-05-21-wire-pl3-nda-creator-into-pl4-shell-design.md`

**Working directory for all commands:** `frontend/` (the FE workspace). Backend stays running but no changes go there.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/e2e/login-dashboard.spec.ts` | edit | Add regression assertion: Mutual NDA card is a link, CSA / Cover Page entries are not links |
| `frontend/src/components/template-card.tsx` | edit | When `template.filename === "Mutual-NDA.md"` render a `<Link>` to the creator; otherwise keep the existing disabled "Coming soon" card unchanged |
| `frontend/e2e/download-pdf.spec.ts` | edit | Unskip; rewrite navigation so each test signs in and opens the creator via the dashboard card |
| `frontend/src/app/dashboard/templates/mutual-nda/page.tsx` | **new** | Server component: load standard terms + parsed blocks, render `<NdaApp />` |
| `frontend/src/components/nda-app.tsx` | edit | Strip outer chrome, restyle header to match dashboard pattern, switch Download button to brand-purple, narrow form column to 360px |

No other files change. Backend, Docker, scripts, catalog, and other components are untouched.

---

## Task 1: TemplateCard — Mutual NDA card becomes a link

**Goal:** Only the Mutual NDA card is clickable; every other card (including Mutual NDA - Cover Page) stays disabled.

**Files:**
- Modify: `frontend/e2e/login-dashboard.spec.ts`
- Modify: `frontend/src/components/template-card.tsx`

### Steps

- [ ] **Step 1: Add a failing e2e regression assertion**

Append a new test inside the existing `test.describe("Login → dashboard", ...)` block in `frontend/e2e/login-dashboard.spec.ts`, after the "sign out returns the user to /login" test:

```ts
  test("Mutual NDA card is a link to the creator; other cards are not", async ({ page }) => {
    const email = uniqueEmail();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Name").fill("Linus Torvalds");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Standalone Mutual NDA = clickable link to the creator.
    const ndaLink = page.locator(
      'a[href="/dashboard/templates/mutual-nda"]',
    );
    await expect(ndaLink).toBeVisible();
    await expect(ndaLink).toContainText("Mutual NDA");

    // The cover-page variant is a separate catalog entry and stays disabled.
    const coverPageCard = page
      .locator("section[aria-label='Available templates'] article")
      .filter({ hasText: "Mutual NDA - Cover Page" });
    await expect(coverPageCard).toBeVisible();
    expect(await coverPageCard.locator("a").count()).toBe(0);

    // CSA stays disabled — no link, disabled Create button.
    const csaCard = page
      .locator("section[aria-label='Available templates'] article")
      .filter({ hasText: "Cloud Service Agreement" });
    await expect(csaCard.getByRole("button", { name: "Create" })).toBeDisabled();
    expect(await csaCard.locator("a").count()).toBe(0);
  });
```

- [ ] **Step 2: Run the new e2e — expect FAIL**

Run from `frontend/`:

```bash
npx playwright test e2e/login-dashboard.spec.ts -g "Mutual NDA card is a link"
```

Expected: FAIL. The link selector `a[href="/dashboard/templates/mutual-nda"]` finds zero elements because every card currently renders as a disabled `<article>`. The test should fail at `await expect(ndaLink).toBeVisible()`.

- [ ] **Step 3: Implement the link/disabled split in TemplateCard**

Replace the entire contents of `frontend/src/components/template-card.tsx` with:

```tsx
import Link from "next/link";

import type { CatalogTemplate } from "@/lib/api";

const MUTUAL_NDA_FILENAME = "Mutual-NDA.md";
const MUTUAL_NDA_ROUTE = "/dashboard/templates/mutual-nda";

export function TemplateCard({ template }: { template: CatalogTemplate }) {
  if (template.filename === MUTUAL_NDA_FILENAME) {
    return (
      <Link
        href={MUTUAL_NDA_ROUTE}
        className="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-2 hover:ring-brand-blue/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      >
        <h2 className="text-base font-semibold text-brand-navy">{template.name}</h2>
        <p className="mt-2 flex-1 text-sm text-brand-gray">{template.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-brand-blue">
            Available
          </span>
          <span className="rounded-md bg-brand-purple px-3 py-1.5 text-xs font-medium text-white">
            Create →
          </span>
        </div>
      </Link>
    );
  }

  return (
    <article className="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-brand-navy">{template.name}</h2>
      <p className="mt-2 flex-1 text-sm text-brand-gray">{template.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-brand-yellow">
          Coming soon
        </span>
        <button
          type="button"
          disabled
          className="rounded-md bg-brand-blue/20 px-3 py-1.5 text-xs font-medium text-brand-blue cursor-not-allowed"
        >
          Create
        </button>
      </div>
    </article>
  );
}
```

Note: the disabled branch is byte-identical to the current implementation. The only new code is the `<Link>` branch and the two constants at the top.

- [ ] **Step 4: Run the e2e — expect PASS**

```bash
npx playwright test e2e/login-dashboard.spec.ts -g "Mutual NDA card is a link"
```

Expected: PASS. The link is now present; cover-page and CSA still render as `<article>` with disabled buttons.

- [ ] **Step 5: Confirm the rest of `login-dashboard.spec.ts` still passes**

```bash
npx playwright test e2e/login-dashboard.spec.ts
```

Expected: all 4 tests PASS. The pre-existing tests don't depend on the card's element type — they only assert `cards.first()` is visible, which works for `<article>` and `<Link>` (Playwright's CSS `article` selector still matches the cover-page / disabled cards; the link-wrapped Mutual NDA card uses `<a>` but the count assertion is `> 0`, not `=== 11`).

- [ ] **Step 6: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/template-card.tsx frontend/e2e/login-dashboard.spec.ts
git commit -m "PL-4: make Mutual NDA dashboard card link to the creator route

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Add the `/dashboard/templates/mutual-nda` route

**Goal:** Clicking the Mutual NDA card lands on a working creator page (still using NdaApp's old chrome — we clean that up in Task 3).

**Files:**
- Modify: `frontend/e2e/download-pdf.spec.ts`
- Create: `frontend/src/app/dashboard/templates/mutual-nda/page.tsx`

### Steps

- [ ] **Step 1: Unskip and rewrite `download-pdf.spec.ts` for the new flow**

Replace the entire contents of `frontend/e2e/download-pdf.spec.ts` with:

```ts
import { expect, test, type Page } from "@playwright/test";
import { PDFParse } from "pdf-parse";
import fs from "node:fs/promises";

const normalize = (s: string) =>
  s.replace(/-\s*\n\s*/g, "").replace(/\s+/g, " ");

const uniqueEmail = () =>
  `nda-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

const signInAndOpenMutualNda = async (page: Page) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.locator('a[href="/dashboard/templates/mutual-nda"]').click();
  await expect(page).toHaveURL(/\/dashboard\/templates\/mutual-nda$/);
  await expect(
    page.getByRole("heading", { name: "Mutual NDA Creator" }),
  ).toBeVisible();
};

test.describe("Download PDF", () => {
  test("downloads a PDF (not a print dialog) and the file contains the filled-in cover page + standard terms", async ({
    page,
  }) => {
    // Fail loudly if the click triggers window.print() — that was the original
    // bug we're guarding against.
    let printInvoked = false;
    await page.exposeFunction("__recordPrint", () => {
      printInvoked = true;
    });
    await page.addInitScript(() => {
      window.print = () => {
        (window as unknown as { __recordPrint: () => void }).__recordPrint();
      };
    });

    await signInAndOpenMutualNda(page);

    await page.getByLabel("Purpose").fill("Evaluating a cloud partnership.");
    await page
      .getByLabel("Effective Date", { exact: true })
      .fill("2026-03-15");
    await page.getByLabel("Governing Law (state)").fill("Delaware");
    await page.getByLabel("Jurisdiction").fill("New Castle County, Delaware");

    const party1 = page.getByRole("group", { name: "Party 1" });
    await party1.getByLabel("Company").fill("Acme Robotics Inc.");
    await party1.getByLabel("Print Name").fill("Alex Rivera");
    await party1.getByLabel("Title").fill("General Counsel");
    await party1
      .getByLabel("Notice Address")
      .fill("100 Main St, Wilmington, DE 19801");
    await party1.getByLabel("Date", { exact: true }).fill("2026-03-15");

    const party2 = page.getByRole("group", { name: "Party 2" });
    await party2.getByLabel("Company").fill("Zenith AI Labs");
    await party2.getByLabel("Print Name").fill("Priya Patel");
    await party2.getByLabel("Title").fill("Head of Legal");
    await party2.getByLabel("Notice Address").fill("legal@zenith.example");
    await party2.getByLabel("Date", { exact: true }).fill("2026-03-15");

    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByTestId("download-pdf").click();
    const download = await downloadPromise;

    expect(printInvoked).toBe(false);

    const suggested = download.suggestedFilename();
    expect(suggested).toBe(
      "Mutual-NDA-Acme-Robotics-Inc-Zenith-AI-Labs.pdf",
    );

    const savePath = `${test.info().outputDir}/${suggested}`;
    await download.saveAs(savePath);

    const stat = await fs.stat(savePath);
    expect(stat.size).toBeGreaterThan(5_000);

    const data = await fs.readFile(savePath);
    expect(data.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const parser = new PDFParse({ data: new Uint8Array(data) });
    let extracted = "";
    try {
      const r = await parser.getText();
      extracted = normalize(r.text);
    } finally {
      await parser.destroy();
    }

    for (const v of [
      "Mutual Non-Disclosure Agreement",
      "PURPOSE",
      "Evaluating a cloud partnership.",
      "March 15, 2026",
      "Delaware",
      "New Castle County, Delaware",
      "Acme Robotics Inc.",
      "Alex Rivera",
      "General Counsel",
      "100 Main St, Wilmington, DE 19801",
      "Zenith AI Labs",
      "Priya Patel",
      "Head of Legal",
      "legal@zenith.example",
      "Standard Terms",
      "1. Introduction",
      "11. General",
    ]) {
      expect(extracted, `expected PDF to contain: ${v}`).toContain(v);
    }
  });

  test("downloads with the generic filename when no party companies are entered", async ({
    page,
  }) => {
    await signInAndOpenMutualNda(page);
    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByTestId("download-pdf").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Mutual-NDA.pdf");
  });

  test("re-enables the Download button after a successful download", async ({
    page,
  }) => {
    await signInAndOpenMutualNda(page);
    const button = page.getByTestId("download-pdf");
    await expect(button).toBeEnabled();
    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await button.click();
    await downloadPromise;
    await expect(button).toBeEnabled({ timeout: 20_000 });
    await expect(button).toHaveText("Download PDF");
  });

  test("reflects 'In perpetuity' confidentiality choice in the rendered PDF", async ({
    page,
  }) => {
    await signInAndOpenMutualNda(page);
    await page
      .getByRole("group", { name: "Term of Confidentiality" })
      .getByRole("radio", { name: "In perpetuity" })
      .check();

    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByTestId("download-pdf").click();
    const download = await downloadPromise;
    const savePath = `${test.info().outputDir}/${download.suggestedFilename()}`;
    await download.saveAs(savePath);

    const data = await fs.readFile(savePath);
    const parser = new PDFParse({ data: new Uint8Array(data) });
    let extracted = "";
    try {
      extracted = normalize((await parser.getText()).text);
    } finally {
      await parser.destroy();
    }
    expect(extracted).toContain("In perpetuity.");
  });
});
```

Changes vs the previous file: drop `test.describe.skip` → `test.describe`; remove the parked-component comment block above the describe; add `uniqueEmail` and `signInAndOpenMutualNda` helpers; replace every `await page.goto("/")` with `await signInAndOpenMutualNda(page);`.

- [ ] **Step 2: Run the rewritten e2e — expect FAIL**

```bash
npx playwright test e2e/download-pdf.spec.ts -g "downloads a PDF"
```

Expected: FAIL during `signInAndOpenMutualNda`, at the `await expect(page).toHaveURL(/\/dashboard\/templates\/mutual-nda$/)` assertion. The Mutual NDA card link resolves to a 404 because the route doesn't exist yet.

- [ ] **Step 3: Create the route page**

Create `frontend/src/app/dashboard/templates/mutual-nda/page.tsx`:

```tsx
import { NdaApp } from "@/components/nda-app";
import {
  loadStandardTerms,
  loadStandardTermsBlocks,
} from "@/lib/templates";

export const metadata = {
  title: "Mutual NDA Creator · Prelegal",
};

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

Notes:
- This is a server component (no `"use client"`). The async function shape and direct `fs` reads via `loadStandardTerms` only work server-side; passing the resulting strings to the client `NdaApp` is fine.
- `loadStandardTerms` and `loadStandardTermsBlocks` already exist in `frontend/src/lib/templates.ts` from PL-3.
- Auth is enforced by the parent `dashboard/layout.tsx` (already calls `getCurrentUser()` and redirects to `/login`) plus the `frontend/src/middleware.ts` matcher `/dashboard/:path*`. No extra auth code is needed here.
- The route inherits the dashboard `<main className="... max-w-6xl ...">` container. NdaApp will render inside it; it still has its own `min-h-screen` + sticky header in this task — visually that's ugly but functional. We fix it in Task 3.

- [ ] **Step 4: Run the rewritten e2e — expect PASS**

```bash
npx playwright test e2e/download-pdf.spec.ts
```

Expected: all 4 tests PASS. The heading "Mutual NDA Creator" is rendered by the (still un-refactored) `NdaApp`; the form selectors (`getByLabel("Purpose")` etc.) and the `data-testid="download-pdf"` button are unchanged from PL-3, so the rest of each test runs to completion.

- [ ] **Step 5: Confirm `login-dashboard.spec.ts` still passes end-to-end**

```bash
npx playwright test e2e/login-dashboard.spec.ts
```

Expected: all 4 tests PASS (including the regression assertion added in Task 1; the link now resolves to a real page).

- [ ] **Step 6: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/dashboard/templates/mutual-nda/page.tsx frontend/e2e/download-pdf.spec.ts
git commit -m "PL-4: route Mutual NDA creator at /dashboard/templates/mutual-nda

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Refactor NdaApp to embed cleanly in the dashboard shell

**Goal:** Drop NdaApp's own page chrome (full-viewport background, sticky title bar, `max-w-7xl` wrapper) and restyle the header to match the existing `/dashboard` page pattern. The Download PDF button moves to brand-purple (matches the project's "submit button" rule).

**Files:**
- Modify: `frontend/src/components/nda-app.tsx`

### Steps

- [ ] **Step 1: Replace the contents of `nda-app.tsx`**

Replace the entire file `frontend/src/components/nda-app.tsx` with:

```tsx
"use client";

import { useCallback, useState } from "react";
import { NdaForm } from "./nda-form";
import { NdaPreview } from "./nda-preview";
import type { Block } from "@/lib/markdown-blocks";
import { defaultNdaData, type NdaData } from "@/lib/nda-schema";

type Props = {
  standardTerms: string;
  standardTermsBlocks: Block[];
};

type DownloadStatus = "idle" | "generating" | "error";

const buildPdfFileName = (data: NdaData): string => {
  const slug = (s: string) =>
    s
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [
    slug(data.party1.company),
    slug(data.party2.company),
  ].filter(Boolean);
  return parts.length > 0
    ? `Mutual-NDA-${parts.join("-")}.pdf`
    : "Mutual-NDA.pdf";
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export function NdaApp({ standardTerms, standardTermsBlocks }: Props) {
  const [data, setData] = useState<NdaData>(defaultNdaData);
  const [status, setStatus] = useState<DownloadStatus>("idle");

  const handleDownload = useCallback(async () => {
    setStatus("generating");
    try {
      const [{ pdf }, { NdaPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/nda-pdf-document"),
      ]);
      const blob = await pdf(
        <NdaPdfDocument
          data={data}
          standardTermsBlocks={standardTermsBlocks}
        />,
      ).toBlob();
      triggerBlobDownload(blob, buildPdfFileName(data));
      setStatus("idle");
    } catch (err) {
      console.error("Failed to generate NDA PDF", err);
      setStatus("error");
    }
  }, [data, standardTermsBlocks]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">
            Mutual NDA Creator
          </h1>
          <p className="mt-1 text-sm text-brand-gray">
            Common Paper Mutual NDA, Version 1.0 — fill in the details to
            generate a downloadable agreement.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            onClick={handleDownload}
            disabled={status === "generating"}
            data-testid="download-pdf"
            className="inline-flex items-center gap-2 rounded-md bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple/90 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "generating" ? "Generating…" : "Download PDF"}
          </button>
          {status === "error" ? (
            <p className="text-xs text-red-600" role="alert">
              Could not generate the PDF. Check the console and try again.
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section className="no-print">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <NdaForm value={data} onChange={setData} />
          </div>
        </section>

        <section>
          <NdaPreview value={data} standardTerms={standardTerms} />
        </section>
      </div>
    </div>
  );
}
```

Changes vs the previous file:
- Deleted the parked-component comment block at the top (lines 3–5).
- Replaced the outer `<div className="min-h-screen bg-slate-100">` with `<div className="space-y-8">` (matches `/dashboard` page spacing).
- Removed the sticky `<header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white">` wrapper and its inner `mx-auto flex max-w-7xl ...` container; the header is now a single flex row that lives inline.
- Heading switched from `text-lg font-semibold text-slate-900` to `text-2xl font-semibold tracking-tight text-brand-navy` to match `/dashboard`'s page header.
- Subtitle switched from `text-xs text-slate-500` to `text-sm text-brand-gray` to match `/dashboard`.
- Download button: `bg-slate-900 hover:bg-slate-800 focus:ring-slate-900/20` → `bg-brand-purple hover:bg-brand-purple/90 focus:ring-brand-purple/40` (submit-button color per `frontend/CLAUDE.md`).
- Replaced the outer `<main className="... max-w-7xl ... grid-cols-[minmax(0,420px)_minmax(0,1fr)]">` with `<div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">` — narrower form column so the two-column fits the dashboard's `max-w-6xl` container, no inner `<main>` (parent layout already supplies one).

Everything else (form, preview, download logic, file naming) is byte-identical.

- [ ] **Step 2: Run the unit tests — expect PASS**

```bash
npm test
```

Expected: all existing vitest suites PASS (`format`, `markdown-blocks`, `nda-schema`, `nda-pdf`). They don't import `NdaApp`, so the refactor can't break them; this is a sanity check.

- [ ] **Step 3: Run the full e2e suite — expect PASS**

```bash
npm run test:e2e
```

Expected: both `login-dashboard.spec.ts` (4 tests) and `download-pdf.spec.ts` (4 tests) PASS. The download-pdf assertions key off the heading "Mutual NDA Creator" and `data-testid="download-pdf"`, both unchanged. The login-dashboard regression assertion keys off the `<Link>` href and the disabled state of CSA — both unchanged.

- [ ] **Step 4: Manual visual smoke check**

In a separate terminal, from `frontend/`:

```bash
npm run dev
```

In a browser at `http://localhost:3000`:
1. You should land on `/login`.
2. Sign in with any email + any name.
3. Land on `/dashboard`. The Mutual NDA card should look distinguishable from the disabled ones (`Available` badge in brand-blue, `Create →` button in brand-purple, hover ring effect).
4. Click the card. You should land on `/dashboard/templates/mutual-nda` with the dashboard sidebar still visible on the left, the topbar still visible at the top, and the creator's title + Download PDF button rendered inline as a dashboard-style page header (no second sticky bar).
5. The form (left, ~360px) and live preview (right) should render side-by-side without horizontal scrolling on a 1280px viewport.
6. The Download PDF button should be brand-purple.
7. Click Download PDF → a PDF file downloads.

Stop the dev server with Ctrl-C when done.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/nda-app.tsx
git commit -m "PL-4: embed NdaApp inside the dashboard shell

Strip the prototype's full-viewport chrome (min-h-screen background,
sticky title bar, max-w-7xl wrapper) so it nests cleanly inside the
dashboard layout's max-w-6xl main container. Header now matches the
/dashboard page pattern (text-2xl text-brand-navy heading,
text-brand-gray subtitle). Download PDF button moves to brand-purple
per the project color scheme.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Final verification

**Goal:** Run the full check suite one more time, confirm the branch is ready.

**Files:** none (verification only)

### Steps

- [ ] **Step 1: Lint**

```bash
cd frontend && npm run lint
```

Expected: no errors, no warnings.

- [ ] **Step 2: Unit tests**

```bash
npm test
```

Expected: all suites PASS (`format`, `markdown-blocks`, `nda-schema`, `nda-pdf`).

- [ ] **Step 3: E2E tests**

```bash
npm run test:e2e
```

Expected: 8/8 PASS (4 in `login-dashboard.spec.ts`, 4 in `download-pdf.spec.ts`).

- [ ] **Step 4: Backend tests (sanity — should be untouched)**

From the repo root:

```bash
cd backend && uv run pytest
```

Expected: all PASS (`test_auth.py`, `test_health.py`, `test_templates.py`).

- [ ] **Step 5: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. (The new `page.tsx` and modified `template-card.tsx` / `nda-app.tsx` are all typed against existing types from `@/lib/api`, `@/lib/nda-schema`, and `@/lib/markdown-blocks`.)

- [ ] **Step 6: Confirm git state is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`. Three commits ahead of where we started.

```bash
git log --oneline -5
```

Expected output (top three are this plan):

```
<hash> PL-4: embed NdaApp inside the dashboard shell
<hash> PL-4: route Mutual NDA creator at /dashboard/templates/mutual-nda
<hash> PL-4: make Mutual NDA dashboard card link to the creator route
aec0669 PL-4: spec — wire PL-3 Mutual NDA creator into the dashboard shell
e5e5546 PL-4: fix frontend Docker image so /api proxy targets backend service
```

---

## Notes & gotchas for the implementing engineer

- **Cache busting**: Next.js dev caches route layouts; if the new `/dashboard/templates/mutual-nda` route 404s after creating the page during Task 2, stop the dev server and run again. No production cache concerns — `dashboard/layout.tsx` already calls `getCurrentUser()` in an async server component, which forces dynamic rendering for everything under `/dashboard/...`.
- **Server-only imports**: `loadStandardTerms` / `loadStandardTermsBlocks` use `"server-only"` and read the filesystem. They MUST be called from a server component (the new `page.tsx` is one). Don't move these into `NdaApp` — that's a client component, and the call would crash the build.
- **`templates/` directory in production**: the Next.js standalone build (`next.config.ts` → `outputFileTracingIncludes`) already bundles `../templates`. The existing PL-3 setup works in the Docker image; this plan doesn't change that.
- **Backend untouched**: `backend/src/prelegal_backend/*`, `docker-compose.yml`, `backend/Dockerfile`, and `frontend/Dockerfile` need no changes.
- **Auth on the new route**: handled implicitly by the dashboard layout + middleware. Don't add a redundant `getCurrentUser()` call in `page.tsx`.
- **`frontend/CLAUDE.md`**: currently says templates list as disabled "Coming soon" cards. Strictly true for 11 of 12 entries after this change; updating that wording is optional and out of scope for this plan — leave it to a follow-up doc PR if needed.
- **`docs/superpowers/specs/2026-05-21-wire-pl3-nda-creator-into-pl4-shell-design.md`** is the spec this plan implements. Read it before starting if anything below feels under-specified.
