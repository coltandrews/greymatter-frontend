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

  it("marks GLP-1 as the initial visible one-time treatment", () => {
    expect(treatmentByKey("glp_1")).toMatchObject({
      billingType: "one_time",
      priceLabel: "GLP-1 consultation and medication review",
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

  it("uses a numeric picker for GLP-1 goal weight", () => {
    expect(
      treatmentQuestions("glp_1").find(
        (question) => question.question_key === "glp_1_goal_weight",
      ),
    ).toMatchObject({
      question_type: "number",
    });
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

  it("only shows GLP-1 mental health follow-ups when mental health history applies", () => {
    const withoutMentalHealthHistory = visibleTreatmentQuestions("glp_1", {
      glp_1_medical_conditions: ["none"],
    }).map((question) => question.question_key);

    expect(withoutMentalHealthHistory).not.toContain("glp_1_mental_health_conditions");
    expect(withoutMentalHealthHistory).not.toContain("glp_1_stable_in_treatment");

    const withMentalHealthHistory = visibleTreatmentQuestions("glp_1", {
      glp_1_medical_conditions: ["depression_anxiety"],
    }).map((question) => question.question_key);

    expect(withMentalHealthHistory).toContain("glp_1_mental_health_conditions");
    expect(withMentalHealthHistory).toContain("glp_1_stable_in_treatment");

    const notApplicableMentalHealthFollowUp = visibleTreatmentQuestions("glp_1", {
      glp_1_medical_conditions: ["psychiatric_disorders"],
      glp_1_mental_health_conditions: ["not_applicable"],
    }).map((question) => question.question_key);

    expect(notApplicableMentalHealthFollowUp).toContain("glp_1_mental_health_conditions");
    expect(notApplicableMentalHealthFollowUp).not.toContain("glp_1_stable_in_treatment");
  });

  it("only shows GLP-1 condition details for selected medical conditions", () => {
    const withoutConditionalHistory = visibleTreatmentQuestions("glp_1", {
      glp_1_medical_conditions: ["none"],
    }).map((question) => question.question_key);

    expect(withoutConditionalHistory).not.toContain("glp_1_cancer_details");
    expect(withoutConditionalHistory).not.toContain("glp_1_future_chemo_or_surgery");
    expect(withoutConditionalHistory).not.toContain("glp_1_liver_disease_details");

    const withCancerHistory = visibleTreatmentQuestions("glp_1", {
      glp_1_medical_conditions: ["cancer"],
    }).map((question) => question.question_key);

    expect(withCancerHistory).toContain("glp_1_cancer_details");
    expect(withCancerHistory).toContain("glp_1_future_chemo_or_surgery");
    expect(withCancerHistory).not.toContain("glp_1_liver_disease_details");

    const withLiverHistory = visibleTreatmentQuestions("glp_1", {
      glp_1_medical_conditions: ["liver_disease"],
    }).map((question) => question.question_key);

    expect(withLiverHistory).toContain("glp_1_liver_disease_details");
    expect(withLiverHistory).not.toContain("glp_1_cancer_details");
    expect(withLiverHistory).not.toContain("glp_1_future_chemo_or_surgery");
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
