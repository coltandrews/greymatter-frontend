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
  await expect(page.getByRole("heading", { name: "State" })).toBeVisible();
  await page.locator("select").selectOption("SC");
  await expect(page.getByRole("heading", { name: "Are You Booking Care For Yourself?" })).toBeVisible();
  await page.locator("label").filter({ hasText: new RegExp(`^${forSelf}$`) }).click();
}

async function fillPeptidesQuestions(page: import("@playwright/test").Page) {
  await expect(page.getByText("What are you hoping to achieve with peptide therapy?")).toBeVisible();
  await page.locator("label").filter({ hasText: "Increased energy" }).click();
  await page.getByRole("button", { name: "Next step" }).click();

  await page.getByLabel(/additional goals/i).fill("More energy.");
  await page.getByRole("button", { name: "Next step" }).click();

  await page.locator("label").filter({ hasText: "None of the above applies" }).click();
  await page.getByRole("button", { name: "Next step" }).click();

  await page.getByLabel(/blood pressure/i).selectOption("120_130_70_80");
  await expect(page.getByLabel(/monitor your blood sugar/i)).toBeVisible();

  await page.getByLabel(/monitor your blood sugar/i).selectOption("does_not_apply");
  await expect(page.getByText("Are you currently taking any growth hormone therapy?")).toBeVisible();

  await page.locator("label").filter({ hasText: /^No$/ }).click();
  await expect(page.getByText("Do you have any of the following symptoms?")).toBeVisible();

  await page.locator("label").filter({ hasText: "Fatigue" }).click();
  await page.getByRole("button", { name: "Next step" }).click();

  await page.getByLabel(/severity/i).fill("2");
  await page.getByRole("button", { name: "Next step" }).click();

  await page.locator("label").filter({ hasText: /^No$/ }).click();
  await expect(page.getByLabel(/inform the doctor/i)).toBeVisible();

  await page.getByLabel(/inform the doctor/i).fill("No other notes.");
}

test("eligible patient completes pre-account intake before account creation", async ({ page }) => {
  await page.goto("/");

  await fillCoreIntake(page);
  await page.getByRole("button", { name: "Peptides" }).click();

  await expect(page.getByRole("heading", { name: "Peptides intake" })).toBeVisible();
  await expect(page.getByText("Are there any additional goals")).not.toBeVisible();
  await fillPeptidesQuestions(page);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  const saved = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);
  expect(saved).not.toBeNull();
  expect(JSON.parse(saved ?? "{}")).toMatchObject({
    legal_first_name: "Pat",
    legal_last_name: "Patient",
    date_of_birth: "1990-01-01",
    gender: "female",
    service_state: "SC",
    for_self: true,
    selected_treatment: "peptides",
    treatment_answers: {
      peptides_goals: ["increased_energy"],
      peptides_provider_notes: "No other notes.",
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
