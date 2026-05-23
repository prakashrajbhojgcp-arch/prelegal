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
