import { expect, test } from "@playwright/test";

const uniqueEmail = () => `ada-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

test.describe("Login → dashboard", () => {
  test("unauthenticated user is redirected from / to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Prelegal" })).toBeVisible();
  });

  test("fake login lands the user on the dashboard with template cards", async ({ page }) => {
    const email = uniqueEmail();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Name").fill("Ada Lovelace");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();

    // Dashboard greets the user
    await expect(page.getByTestId("user-name")).toHaveText("Ada Lovelace");

    // Catalog has 11 templates per config.json — be loose to survive catalog edits.
    const cards = page.locator("section[aria-label='Available templates'] article");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("sign out returns the user to /login", async ({ page }) => {
    const email = uniqueEmail();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Name").fill("Grace Hopper");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
