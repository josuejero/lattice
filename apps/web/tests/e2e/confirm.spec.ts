import { test, expect } from "@playwright/test";
import {
  uniqueOrgName,
  signInAndCreateOrg,
  goToAvailability,
  configureWeeklyAvailability,
  createAvailabilityOverride,
  goToSuggestions,
  createSuggestionRequest,
} from "./helpers/demo-flow";

test("confirms a suggestion and shows the scheduled event", async ({ page }) => {
  const orgName = uniqueOrgName("Confirm Org");
  const requestTitle = `Playwright confirm ${Date.now()}`;

  await signInAndCreateOrg(page, orgName);
  await goToAvailability(page);
  await configureWeeklyAvailability(page);
  await createAvailabilityOverride(page, { note: "Confirm override" });

  await goToSuggestions(page);
  const { first: topCandidate } = await createSuggestionRequest(page, requestTitle);
  const confirmButton = topCandidate.getByRole("button", { name: "Confirm this slot" });

  await Promise.all([
    page.waitForURL(/\/events\/[^/]+$/),
    confirmButton.click(),
  ]);

  await expect(page.getByRole("heading", { name: requestTitle })).toBeVisible();
  await expect(page.getByText("Time:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Attendees" })).toBeVisible();
});
