import { expect, test } from "@playwright/test";

const storageKey = "greymatter_pre_auth_intake";

async function fillCoreIntake(page: import("@playwright/test").Page, forSelf: "Yes" | "No" = "Yes") {
  await expect(page.getByRole("heading", { name: "First Name" })).toBeVisible();
  await page.locator("input").fill("Pat");
  await page.getByRole("button", { name: "Next step" }).click();
  await page.locator("input").fill("Patient");
  await page.getByRole("button", { name: "Next step" }).click();
  await page.locator("input").fill("1990-01-01");
  await page.getByRole("button", { name: "Next step" }).click();
  await page.locator("select").selectOption("female");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("heading", { name: "State" })).toBeVisible();
  await page.locator("select").selectOption("SC");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("heading", { name: "Are You Booking Care For Yourself?" })).toBeVisible();
  await page.locator("label").filter({ hasText: new RegExp(`^${forSelf}$`) }).click();
  await page.getByRole("button", { name: "Choose treatment" }).click();
}

async function fillGlpQuestions(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "GLP-1 intake" })).toBeVisible();
  await page.getByLabel(/pregnancy or breastfeeding status/i).selectOption("none_not_applicable");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByText("How would you describe your ethnicity?")).toBeVisible();

  await page.locator("label").filter({ hasText: "I prefer not to answer" }).click();
  await page.getByRole("button", { name: "Next step" }).click();

  await page.getByLabel(/goal weight/i).fill("180");
  await page.getByRole("button", { name: "Next step" }).click();

  await page.locator("label").filter({ hasText: "None of the above" }).click();
  await page.getByRole("button", { name: "Next step" }).click();

  await page.getByLabel(/ever taken a GLP-1 medication/i).selectOption("never_taken");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByLabel(/which one are you currently taking/i)).toBeVisible();

  await page.getByLabel(/which one are you currently taking/i).selectOption("none");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByLabel(/other GLP-1 medication/i)).toBeVisible();

  await page.getByLabel(/other GLP-1 medication/i).fill("None");
  await page.getByRole("button", { name: "Next step" }).click();

  await page.locator("label").filter({ hasText: "Not Applicable" }).click();
  await page.getByRole("button", { name: "Next step" }).click();

  await page.getByLabel(/other side effects/i).fill("None");
  await page.getByRole("button", { name: "Next step" }).click();

  await page.getByLabel(/muscle loss/i).selectOption("does_not_apply");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByLabel(/successful has your GLP-1 experience/i)).toBeVisible();

  await page.getByLabel(/successful has your GLP-1 experience/i).selectOption("none_not_applicable");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByLabel(/happy with your current GLP-1 dose/i)).toBeVisible();

  await page.getByLabel(/happy with your current GLP-1 dose/i).selectOption("not_applicable");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByText("Do you have, or have you ever had")).toBeVisible();

  await page.locator("label").filter({ hasText: "None of the above" }).click();
  await page.getByRole("button", { name: "Next step" }).click();

  await page.locator("label").filter({ hasText: "Not Applicable" }).click();
  await page.getByRole("button", { name: "Next step" }).click();

  await page.getByLabel(/stable in treatment/i).selectOption("does_not_apply");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByLabel(/specific cancer/i)).toBeVisible();

  await page.getByLabel(/specific cancer/i).fill("N/A");
  await page.getByRole("button", { name: "Next step" }).click();

  await page.getByLabel(/chemotherapy or surgical treatment/i).selectOption("does_not_apply");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByLabel(/diagnosed with liver conditions/i)).toBeVisible();

  await page.getByLabel(/diagnosed with liver conditions/i).fill("N/A");
  await page.getByRole("button", { name: "Next step" }).click();

  await page.locator("label").filter({ hasText: "No, none of these" }).click();
  await page.getByRole("button", { name: "Next step" }).click();

  await page.getByLabel(/supplements/i).fill("None");
  await page.getByRole("button", { name: "Next step" }).click();

  await page.getByLabel(/drink alcohol/i).selectOption("never");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByText("Do you smoke or use nicotine?")).toBeVisible();

  await page.locator("label").filter({ hasText: /^No$/ }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByLabel(/exercise routine/i)).toBeVisible();

  await page.getByLabel(/exercise routine/i).selectOption("light");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByLabel(/further information/i)).toBeVisible();

  await page.getByLabel(/further information/i).fill("No other notes.");
}

test("eligible patient completes pre-account intake before account creation", async ({ page }) => {
  await page.goto("/");

  await fillCoreIntake(page);
  await expect(page.getByRole("button", { name: "GLP-1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Peptides" })).toHaveCount(0);
  await page.getByRole("button", { name: "GLP-1" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await fillGlpQuestions(page);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  const terms = page.getByLabel("Terms of service and privacy information");
  await expect(terms).toBeVisible();
  await expect(page.getByLabel(/I have reviewed and agree/i)).toBeDisabled();
  await terms.evaluate((node) => {
    const element = node as HTMLElement;
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect(page.getByLabel(/I have reviewed and agree/i)).toBeEnabled();
  const saved = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);
  expect(saved).not.toBeNull();
  expect(JSON.parse(saved ?? "{}")).toMatchObject({
    legal_first_name: "Pat",
    legal_last_name: "Patient",
    date_of_birth: "1990-01-01",
    gender: "female",
    service_state: "SC",
    for_self: true,
    selected_treatment: "glp_1",
    treatment_answers: {
      glp_1_pregnancy_breastfeeding_status: "none_not_applicable",
      glp_1_ethnicity: ["prefer_not_answer"],
      glp_1_provider_notes: "No other notes.",
    },
  });
});

test("pre-account intake blocks unsupported booking-for-someone-else flow", async ({ page }) => {
  await page.goto("/");

  await fillCoreIntake(page, "No");

  await expect(
    page.getByText("Please continue only if you are completing this intake for yourself."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Are You Booking Care For Yourself?" })).toBeVisible();
});

test("pre-account intake sign-in link opens the sign-in form", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Already have an account? Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "First Name" })).toBeVisible();
});
