import { describe, expect, it } from "vitest";
import {
  PATIENT_TREATMENTS,
  TREATMENTS,
  treatmentByKey,
  treatmentQuestions,
  treatmentQuestionSet,
  visibleTreatmentQuestions,
} from "./treatments";

describe("treatment registry", () => {
  it("keeps every treatment wired to an active question set", () => {
    for (const treatment of TREATMENTS) {
      const set = treatmentQuestionSet(treatment.key);
      expect(set).toMatchObject({
        treatmentKey: treatment.key,
        source: "ola",
        version: expect.stringContaining("ola-initial"),
      });
      expect(treatmentQuestions(treatment.key).length).toBeGreaterThan(0);
      expect(treatment.consultationFeeCents).toBeGreaterThan(0);
      expect(treatment.medicationFeeCents).toBeGreaterThan(0);
      expect(["one_time", "subscription"]).toContain(treatment.billingType);
    }
  });

  it("marks GLP-1 as the initial subscription treatment", () => {
    expect(treatmentByKey("glp_1")).toMatchObject({
      billingType: "subscription",
      priceLabel: "GLP-1 subscription plan",
      patientVisible: true,
    });
    expect(treatmentByKey("peptides")).toMatchObject({
      billingType: "one_time",
      patientVisible: false,
    });
    expect(treatmentByKey("testosterone")).toMatchObject({
      billingType: "one_time",
      patientVisible: false,
    });
    expect(PATIENT_TREATMENTS.map((treatment) => treatment.key)).toEqual(["glp_1"]);
  });

  it("contains the launch initial intake depth for each medication", () => {
    expect(treatmentQuestions("glp_1")).toHaveLength(24);
    expect(treatmentQuestions("peptides")).toHaveLength(10);
    expect(treatmentQuestions("testosterone")).toHaveLength(12);
  });

  it("skips prior GLP-1 experience questions when the patient has never taken GLP-1s", () => {
    const keys = visibleTreatmentQuestions("glp_1", {
      glp_1_prior_medication_status: "never_taken",
    }).map((question) => question.question_key);

    expect(keys).toContain("glp_1_prior_medication_status");
    expect(keys).toContain("glp_1_medical_conditions");
    expect(keys).not.toContain("glp_1_current_medication");
    expect(keys).not.toContain("glp_1_side_effects");
    expect(keys).not.toContain("glp_1_muscle_loss");
    expect(keys).not.toContain("glp_1_experience_success");
    expect(keys).not.toContain("glp_1_current_dose_satisfaction");
  });

  it("skips current GLP-1 dosing questions when the patient used GLP-1s only in the past", () => {
    const keys = visibleTreatmentQuestions("glp_1", {
      glp_1_prior_medication_status: "taken_in_past",
    }).map((question) => question.question_key);

    expect(keys).not.toContain("glp_1_current_medication");
    expect(keys).not.toContain("glp_1_other_current_medication");
    expect(keys).not.toContain("glp_1_current_dose_satisfaction");
    expect(keys).toContain("glp_1_side_effects");
    expect(keys).toContain("glp_1_experience_success");
  });

  it("returns null or empty values for unknown selections", () => {
    expect(treatmentByKey("unknown")).toBeNull();
    expect(treatmentQuestionSet(null)).toBeNull();
    expect(treatmentQuestions(null)).toEqual([]);
  });
});
