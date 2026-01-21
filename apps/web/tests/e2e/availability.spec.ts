import { test, expect } from "@playwright/test";
import {
  uniqueOrgName,
  signInAndCreateOrg,
  goToAvailability,
  configureWeeklyAvailability,
  createAvailabilityOverride,
} from "./helpers/demo-flow";

test("configures a weekly template with an override", async ({ page }) => {
  const orgName = uniqueOrgName("Availability Org");
  await signInAndCreateOrg(page, orgName);
  await goToAvailability(page);
  await configureWeeklyAvailability(page);

  const overrideNote = `Playwright block ${Date.now()}`;
  await createAvailabilityOverride(page, { note: overrideNote });

  await expect(page.getByText(overrideNote)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Effective availability preview" })).toBeVisible();
});
