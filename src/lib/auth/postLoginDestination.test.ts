import { describe, expect, it } from "vitest";
import { postLoginDestination } from "./postLoginDestination";

const completeProfile = {
  legal_first_name: "Pat",
  legal_last_name: "Patient",
  date_of_birth: "1990-01-01",
  gender: "female",
  phone: "555-123-4567",
};

describe("postLoginDestination", () => {
  it("sends staff and admin users to the dashboard", () => {
    expect(postLoginDestination({ role: "staff" })).toBe("/dashboard");
    expect(postLoginDestination({ role: "admin" })).toBe("/dashboard");
  });

  it("sends patients with complete member profiles to the hub", () => {
    expect(postLoginDestination({
      role: "patient",
      profileDemographics: completeProfile,
    })).toBe("/hub");
  });

  it("sends patients with incomplete member profiles to onboarding", () => {
    expect(postLoginDestination({
      role: "patient",
      profileDemographics: {
        legal_first_name: "Pat",
        legal_last_name: "Patient",
      },
    })).toBe("/onboarding");
  });

  it("treats missing roles as patient access and can use draft demographics", () => {
    expect(postLoginDestination({
      role: null,
      draftData: completeProfile,
    })).toBe("/hub");
  });
});
