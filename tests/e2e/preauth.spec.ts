import { expect, test } from "@playwright/test";

const storageKey = "greymatter_pre_auth_intake";

test("eligible patient completes pre-account intake before account creation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Check eligibility" })).toBeVisible();
  await page.getByLabel("First Name").fill("Pat");
  await page.getByLabel("Last Name").fill("Patient");
  await page.getByLabel("Date Of Birth").fill("1990-01-01");
  await page.getByLabel("Gender").selectOption("female");
  await page.getByLabel("State").selectOption("SC");
  await page.getByRole("radio", { name: "Yes" }).check();
  await page.getByRole("button", { name: "Continue" }).click();

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
  });
});

test("pre-account intake blocks unsupported booking-for-someone-else flow", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("First Name").fill("Pat");
  await page.getByLabel("Last Name").fill("Patient");
  await page.getByLabel("Date Of Birth").fill("1990-01-01");
  await page.getByLabel("Gender").selectOption("female");
  await page.getByLabel("State").selectOption("SC");
  await page.getByRole("radio", { name: "No" }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByText("This online flow currently supports patients booking for themselves."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Check eligibility" })).toBeVisible();
});

test("pre-account intake sign-in link opens the sign-in form", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Already have an account? Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
