import { describe, expect, it } from "vitest";
import { shouldStartAtMedicationSelection } from "./loggedInRequestFlow";

const completePatientData = {
  legal_first_name: "Pat",
  legal_last_name: "Patient",
  date_of_birth: "1990-01-01",
  gender: "female",
  service_state: "SC",
  address_state: "SC",
  for_self: true,
};

describe("logged-in medication request flow", () => {
  it("starts complete authenticated patients at medication selection", () => {
    expect(
      shouldStartAtMedicationSelection({
        initialPatientData: completePatientData,
        isAuthenticated: true,
        requestedNewMedication: true,
      }),
    ).toBe(true);
  });

  it("keeps incomplete, signed-out, or ordinary visits in the eligibility flow", () => {
    expect(
      shouldStartAtMedicationSelection({
        initialPatientData: { ...completePatientData, for_self: false },
        isAuthenticated: true,
        requestedNewMedication: true,
      }),
    ).toBe(false);
    expect(
      shouldStartAtMedicationSelection({
        initialPatientData: completePatientData,
        isAuthenticated: false,
        requestedNewMedication: true,
      }),
    ).toBe(false);
    expect(
      shouldStartAtMedicationSelection({
        initialPatientData: completePatientData,
        isAuthenticated: true,
        requestedNewMedication: false,
      }),
    ).toBe(false);
  });
});
