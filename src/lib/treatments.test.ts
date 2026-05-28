import { describe, expect, it } from "vitest";
import {
  PATIENT_TREATMENTS,
  TREATMENTS,
  treatmentByKey,
  treatmentQuestions,
  treatmentQuestionSet,
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

  it("returns null or empty values for unknown selections", () => {
    expect(treatmentByKey("unknown")).toBeNull();
    expect(treatmentQuestionSet(null)).toBeNull();
    expect(treatmentQuestions(null)).toEqual([]);
  });
});
