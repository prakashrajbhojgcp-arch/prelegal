import { test, expect } from "@playwright/test";

const uniqueEmail = () =>
  `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

test("mutual NDA chat — happy path, preview updates, PDF downloads", async ({ page }) => {
  // 1. Stub the chat endpoint with a canned sequence of responses.
  let turn = 0;
  const baseFields = {
    purpose: "Evaluating a deal.",
    effectiveDate: "2026-05-23",
    mndaTerm: { kind: "years", years: 1 },
    confidentialityTerm: { kind: "years", years: 1 },
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    party1: { name: "Ada", title: "CEO", company: "Acme Inc.", noticeAddress: "1 Main St", date: "2026-05-23" },
    party2: { name: "Grace", title: "CTO", company: "Globex Corp.", noticeAddress: "g@g.co", date: "2026-05-23" },
  };
  const finalFields = { ...baseFields, governingLaw: "Delaware", jurisdiction: "New Castle, DE" };

  await page.route("**/api/templates/mutual-nda/chat", async (route) => {
    turn += 1;
    const body =
      turn === 1
        ? {
            assistantMessage: "Got it — what state governs?",
            mergedFields: baseFields,
            isComplete: false,
          }
        : turn === 2
        ? {
            assistantMessage: "Great. What city is jurisdiction in?",
            mergedFields: { ...baseFields, governingLaw: "Delaware" },
            isComplete: false,
          }
        : {
            assistantMessage: "All set!",
            mergedFields: finalFields,
            isComplete: true,
          };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  // 2. Log in via fake-auth (same pattern as login-dashboard.spec.ts).
  await page.goto("/login");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/templates/mutual-nda");

  // 3. Initial greeting renders.
  await expect(
    page.getByText(/Hi — I'll help you draft a Common Paper Mutual NDA/),
  ).toBeVisible();

  // The chat textarea is uniquely identified by its placeholder.
  const chatInput = page.getByPlaceholder("Type a message…");
  const sendButton = page.getByRole("button", { name: /^send$/i });

  // Turn 1.
  await chatInput.fill("Acme Inc. and Globex Corp.");
  await sendButton.click();
  await expect(page.getByText("Got it — what state governs?")).toBeVisible();
  // Preview now contains "Acme Inc." somewhere in the document.
  await expect(page.getByText("Acme Inc.").first()).toBeVisible();

  // Turn 2.
  await chatInput.fill("Delaware");
  await sendButton.click();
  await expect(page.getByText("Great. What city is jurisdiction in?")).toBeVisible();

  // Turn 3 — completes.
  await chatInput.fill("New Castle, DE");
  await sendButton.click();
  await expect(page.getByText("All set!")).toBeVisible();
  await expect(page.getByText(/Ready to download/i)).toBeVisible();

  // 4. Open the "Edit fields manually" panel and assert a form field is visible.
  await page.getByText("Edit fields manually", { exact: true }).click();
  await expect(page.getByLabel("Purpose")).toBeVisible();

  // 5. Click Download PDF and verify a download fires.
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByTestId("download-pdf").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^Mutual-NDA-Acme-Inc-Globex-Corp\.pdf$/);
});
