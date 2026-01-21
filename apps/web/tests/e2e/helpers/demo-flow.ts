import { expect, type Locator, type Page } from "@playwright/test";

export const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
export const devEmail = "dev@example.com";

function formatLocalDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function uniqueOrgName(prefix = "Playwright Org") {
  const suffix = Math.floor(Date.now() / 1000);
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix} ${suffix}-${random}`;
}

export async function signIn(page: Page) {
  await page.goto(`${baseUrl}/signin`);
  await page.getByLabel("Email (dev/test)").fill(devEmail);
  await Promise.all([
    page.waitForURL(`${baseUrl}/dashboard`),
    page.getByRole("button", { name: "Continue", exact: true }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

export async function createOrg(page: Page, orgName: string) {
  await page.getByPlaceholder("e.g. Delaware DSA").fill(orgName);
  await page.getByRole("button", { name: "Create" }).click();
  const orgLabel = page.locator("span.font-medium", { hasText: orgName });
  await expect(orgLabel).toBeVisible();
}

export async function signInAndCreateOrg(page: Page, orgName: string) {
  await signIn(page);
  await createOrg(page, orgName);
}

export async function goToAvailability(page: Page) {
  await page.goto(`${baseUrl}/availability`);
  await expect(page.getByRole("heading", { name: "Availability", exact: true })).toBeVisible();
}

export async function configureWeeklyAvailability(page: Page, options?: { start?: string; end?: string }) {
  const start = options?.start ?? "09:00";
  const end = options?.end ?? "17:00";
  const template = page.locator('section:has-text("Weekly template")');
  await template.getByRole("button", { name: "+ Add window" }).first().click();
  const timeInputs = template.locator('input[type="time"]');
  await timeInputs.nth(0).fill(start);
  await timeInputs.nth(1).fill(end);
  await template.getByRole("button", { name: "Save template" }).click();
  const saved = page.getByText("Saved");
  await expect(saved).toBeVisible({ timeout: 15000 });
  await expect(saved).toBeHidden({ timeout: 5000 });
}

export async function createAvailabilityOverride(
  page: Page,
  options?: {
    date?: string;
    start?: string;
    end?: string;
    kind?: "UNAVAILABLE" | "AVAILABLE";
    note?: string;
  },
) {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const overrideDate = options?.date ?? formatLocalDate(now);
  const start = options?.start ?? "12:00";
  const end = options?.end ?? "13:00";
  const kind = options?.kind ?? "UNAVAILABLE";
  const note = options?.note ?? "Playwright override";
  const overridesSection = page.locator('section:has-text("OverridesAdd specific dates")');
  await overridesSection.getByLabel(/^Date/).fill(overrideDate);
  await overridesSection.getByLabel(/^Start/).fill(start);
  await overridesSection.getByLabel(/^End/).fill(end);
  const kindCombobox = overridesSection.getByRole("combobox").first();
  await kindCombobox.click();
  const optionName = kind === "AVAILABLE" ? "AVAILABLE (add)" : "UNAVAILABLE (subtract)";
  await page.getByRole("option", { name: optionName }).click();
  await overridesSection.getByLabel(/^Note/).fill(note);
  await overridesSection.getByRole("button", { name: "Create override" }).click();
  const noteLocator = page.getByText(note);
  await expect(noteLocator).toBeVisible({ timeout: 15000 });
  return note;
}

export async function goToSuggestions(page: Page) {
  await page.goto(`${baseUrl}/suggestions`);
  await expect(page.getByRole("heading", { name: "Suggestions" })).toBeVisible();
}

export type SuggestionCandidates = {
  list: Locator;
  first: Locator;
};

export async function createSuggestionRequest(
  page: Page,
  title: string,
  opts?: { startDate?: string; endDate?: string },
): Promise<SuggestionCandidates> {
  const form = page.locator("form");
  await form.getByLabel("Title (optional)").fill(title);
  const startDate = opts?.startDate ?? formatLocalDate(new Date());
  const endDate =
    opts?.endDate ?? formatLocalDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  await form.getByLabel("Range start").fill(startDate);
  await form.getByLabel("Range end").fill(endDate);
  const generateButton = form.getByRole("button", { name: "Generate suggestions" });
  await expect(generateButton).toBeEnabled({ timeout: 30000 });
  await generateButton.click();
  const candidateList = page.locator('section:has-text("Results") ol li');
  await expect(candidateList.first()).toBeVisible({ timeout: 30000 });
  await expect(candidateList.first()).toContainText("attendees available");
  return { list: candidateList, first: candidateList.first() };
}
