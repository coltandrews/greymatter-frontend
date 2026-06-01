import { describe, expect, it } from "vitest";
import {
  basicInfoComplete,
  memberProfileComplete,
  type IntakeDraftData,
} from "./draftData";

const profile: IntakeDraftData = {
  legal_first_name: "Colt",
  legal_last_name: "Andrews",
  date_of_birth: "1998-04-15",
  gender: "male",
  phone: "8439259115",
};

describe("memberProfileComplete", () => {
  it("requires only identity and phone for account onboarding", () => {
    expect(memberProfileComplete(profile)).toBe(true);
    expect(basicInfoComplete(profile)).toBe(false);
  });

  it("rejects missing phone and unsupported gender values", () => {
    expect(memberProfileComplete({ ...profile, phone: "" })).toBe(false);
    expect(memberProfileComplete({ ...profile, gender: "other" })).toBe(false);
  });
});
