import { describe, expect, it } from "vitest";
import {
  buildPreAuthIntakeData,
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
      pre_signup_answers: {
        glp_1_history: "no",
      },
      selected_treatment: "glp_1",
      treatment_answers: {
        glp_1_current_weight: "210",
      },
    });

    expect(parsePreAuthIntake(raw)).toEqual({
      legal_first_name: "Pat",
      legal_last_name: "Patient",
      date_of_birth: "1990-01-01",
      gender: "female",
      service_state: "SC",
      address_state: "SC",
      for_self: true,
      pre_signup_answers: {
        glp_1_history: "no",
      },
      selected_treatment: "glp_1",
      treatment_answers: {
        glp_1_current_weight: "210",
      },
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

  it("builds saved intake data from every rendered question", () => {
    const data = buildPreAuthIntakeData(
      [
        { question_key: "legal_first_name", question_type: "text" },
        { question_key: "legal_last_name", question_type: "text" },
        { question_key: "date_of_birth", question_type: "date" },
        { question_key: "gender", question_type: "select" },
        { question_key: "service_state", question_type: "select" },
        { question_key: "for_self", question_type: "yes_no" },
        { question_key: "symptoms", question_type: "multi_select" },
      ],
      {
        legal_first_name: " Pat ",
        legal_last_name: " Patient ",
        date_of_birth: "1990-01-01",
        gender: "female",
        service_state: "SC",
        for_self: "yes",
        symptoms: ["nausea", "fatigue"],
      },
      {
        selectedTreatment: "testosterone",
        questions: [
          { question_key: "testosterone_symptoms", question_type: "multi_select" },
        ],
        answers: {
          testosterone_symptoms: ["low_energy", "mood"],
        },
      },
    );

    expect(data).toMatchObject({
      legal_first_name: "Pat",
      legal_last_name: "Patient",
      service_state: "SC",
      address_state: "SC",
      for_self: true,
      pre_signup_answers: {
        legal_first_name: "Pat",
        legal_last_name: "Patient",
        date_of_birth: "1990-01-01",
        gender: "female",
        service_state: "SC",
        for_self: "yes",
        symptoms: ["nausea", "fatigue"],
      },
      selected_treatment: "testosterone",
      treatment_answers: {
        testosterone_symptoms: ["low_energy", "mood"],
      },
    });
  });
});
