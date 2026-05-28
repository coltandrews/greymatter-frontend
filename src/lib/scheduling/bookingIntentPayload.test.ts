import { describe, expect, it } from "vitest";
import {
  buildTreatmentBookingIntentPayload,
  GREYMATTER_SERVICE_KEY,
} from "./bookingIntentPayload";

describe("buildTreatmentBookingIntentPayload", () => {
  it("builds a no-schedule treatment booking intent from saved intake", () => {
    const payload = buildTreatmentBookingIntentPayload({
      legal_first_name: "Pat",
      legal_last_name: "Patient",
      service_state: "SC",
      selected_treatment: "glp_1",
      pre_signup_answers: {
        service_state: "SC",
        for_self: "yes",
      },
      treatment_answers: {
        glp_1_pregnancy_breastfeeding_status: "none_not_applicable",
        glp_1_ethnicity: ["white_caucasian", "prefer_not_answer"],
        glp_1_goal_weight: "180",
        glp_1_previous_weight_loss_attempts: ["diet_exercise", "fasting"],
        glp_1_prior_medication_status: "never_taken",
        glp_1_current_medication: "injectable_semaglutide",
        glp_1_experience_success: "very_successful",
        glp_1_mental_health_conditions: ["major_depression"],
        glp_1_stable_in_treatment: "yes",
      },
    });

    expect(payload).toMatchObject({
      serviceState: "SC",
      serviceKey: GREYMATTER_SERVICE_KEY,
      serviceType: "initial",
      appointmentAnswers: {
        State: "SC",
        "Are You Booking Care For Yourself?": "yes",
        "Please select any option that best describes your current pregnancy or breastfeeding status, including menstrual timing if relevant:": "None / Not applicable",
        "How would you describe your ethnicity? Please select all that apply.": "White or Caucasian, I prefer not to answer",
        "Please enter your goal weight:": "180",
        "Have you had any previous weight loss attempts? If so, which methods have you tried?": "Diet & Exercise, Fasting",
        "Are you currently or have you ever taken a GLP-1 medication?": "I have never taken a GLP-1 medication",
      },
    });
    expect(payload.appointmentAnswers).not.toHaveProperty(
      "If you are currently taking a GLP-1 medication which one are you currently taking?",
    );
    expect(payload.appointmentAnswers).not.toHaveProperty(
      "How successful has your GLP-1 experience been?",
    );
    expect(payload.appointmentAnswers).not.toHaveProperty(
      "If you checked Depression/Anxiety or Psychiatric Disorders, have you been diagnosed with any of the following mental health conditions?",
    );
    expect(payload.appointmentAnswers).not.toHaveProperty("Are you stable in treatment?");
    expect(payload.selectedSlot).toBeUndefined();
  });

  it("formats Peptides initial answers for Ola service_data", () => {
    const payload = buildTreatmentBookingIntentPayload({
      legal_first_name: "Pat",
      legal_last_name: "Patient",
      service_state: "SC",
      selected_treatment: "peptides",
      treatment_answers: {
        peptides_goals: ["increased_energy", "recovery_healing"],
        peptides_blood_pressure: "120_130_70_80",
        peptides_growth_hormone_therapy: "no",
      },
    });

    expect(payload.appointmentAnswers).toMatchObject({
      "What are you hoping to achieve with peptide therapy?": "Increased energy, Recovery / healing",
      "Please provide your blood pressure reading from the last 6 weeks:": "120-130/70-80",
      "Are you currently taking any growth hormone therapy?": "no",
    });
  });

  it("formats Testosterone initial answers for Ola service_data", () => {
    const payload = buildTreatmentBookingIntentPayload({
      legal_first_name: "Pat",
      legal_last_name: "Patient",
      service_state: "SC",
      selected_treatment: "testosterone",
      treatment_answers: {
        testosterone_goals: ["boost_energy", "improve_mood"],
        testosterone_symptom_onset: "6_12_months",
        testosterone_risk_benefit_consent: "yes_i_agree",
      },
    });

    expect(payload.appointmentAnswers).toMatchObject({
      "What are your goals for TRT treatment?": "Boost energy, Improve mood",
      "When did your symptoms begin?": "6-12 months ago",
      "Do you understand the risks and benefits of TRT and consent to treatment if prescribed?": "Yes, I Agree",
    });
  });
});
