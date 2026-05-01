import { describe, expect, it } from "vitest";
import {
  isPreAuthIntakeComplete,
  parsePreAuthIntake,
  serializePreAuthIntake,
} from "./preAuthIntake";

describe("pre-auth intake", () => {
  it("accepts complete self-service eligibility data", () => {
    const raw = serializePreAuthIntake({
      legal_first_name: " Pat ",
      legal_last_name: " Patient ",
      date_of_birth: "1990-01-01",
      gender: "female",
      service_state: "SC",
      address_state: "SC",
      for_self: true,
    });

    expect(parsePreAuthIntake(raw)).toEqual({
      legal_first_name: "Pat",
      legal_last_name: "Patient",
      date_of_birth: "1990-01-01",
      gender: "female",
      service_state: "SC",
      address_state: "SC",
      for_self: true,
    });
  });

  it("rejects incomplete or unsupported pre-auth intake", () => {
    expect(parsePreAuthIntake(null)).toBeNull();
    expect(parsePreAuthIntake("{bad json")).toBeNull();
    expect(
      isPreAuthIntakeComplete({
        legal_first_name: "Pat",
        legal_last_name: "Patient",
        date_of_birth: "1990-01-01",
        gender: "female",
        service_state: "SC",
        address_state: "SC",
        for_self: false,
      }),
    ).toBe(false);
  });
});
