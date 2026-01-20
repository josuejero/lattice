import { test, expect } from "@playwright/test";

test("dev sign-in reaches dashboard", async ({ page }) => {
  await page.goto("http://localhost:3000/signin");
  await page.getByLabel("Email (dev/test)").fill("dev@example.com");
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
