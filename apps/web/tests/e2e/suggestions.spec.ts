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

test("creates a suggestion request and shows the explanation", async ({ page }) => {
  const orgName = uniqueOrgName("Suggestions Org");
  const requestTitle = `Playwright request ${Date.now()}`;

  await signInAndCreateOrg(page, orgName);
  await goToAvailability(page);
  await configureWeeklyAvailability(page);
  await createAvailabilityOverride(page, { note: "Phase-2 override" });

  await goToSuggestions(page);
  const { first: topCandidate } = await createSuggestionRequest(page, requestTitle);

  await expect(topCandidate).toContainText("attendees available");
  await expect(topCandidate.getByRole("button", { name: "Confirm this slot" })).toBeVisible();
});
