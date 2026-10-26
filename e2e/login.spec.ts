import { expect, test } from "@playwright/test";

test("seeded Carer can sign in and view the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("name@careapp.com").fill("e2e.carer@example.test");
  await page.locator('input[autocomplete="current-password"]').fill("E2E-care-passphrase-123!");
  await page.getByRole("button", { name: /Sign In to Dashboard/ }).click();

  await expect(page).toHaveURL(/\/user\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Carer Portal" })).toBeVisible();
});