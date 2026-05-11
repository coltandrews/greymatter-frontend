import type { IntakeDraftData } from "./draftData";
import {
  normalizeIntakeAnswers,
  type IntakeQuestion,
  type IntakeQuestionAnswers,
} from "./intakeQuestions";
import type { TreatmentKey } from "@/lib/treatments";

export const PRE_AUTH_INTAKE_STORAGE_KEY = "greymatter_pre_auth_intake";

export type PreAuthIntakeData = Pick<
  IntakeDraftData,
  | "legal_first_name"
  | "legal_last_name"
  | "date_of_birth"
  | "gender"
  | "service_state"
  | "address_state"
  | "for_self"
> & {
  pre_signup_answers?: IntakeQuestionAnswers;
  selected_treatment?: TreatmentKey | string;
  treatment_answers?: IntakeQuestionAnswers;
};

function stringValue(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

export function parsePreAuthIntake(raw: string | null): PreAuthIntakeData | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const forSelf = record.for_self;
    const answers =
      record.pre_signup_answers &&
      typeof record.pre_signup_answers === "object" &&
      !Array.isArray(record.pre_signup_answers)
        ? (record.pre_signup_answers as IntakeQuestionAnswers)
        : undefined;
    const treatmentAnswers =
      record.treatment_answers &&
      typeof record.treatment_answers === "object" &&
      !Array.isArray(record.treatment_answers)
        ? (record.treatment_answers as IntakeQuestionAnswers)
        : undefined;
    const data: PreAuthIntakeData = {
      legal_first_name: stringValue(record, "legal_first_name"),
      legal_last_name: stringValue(record, "legal_last_name"),
      date_of_birth: stringValue(record, "date_of_birth"),
      gender: stringValue(record, "gender"),
      service_state: stringValue(record, "service_state"),
      address_state: stringValue(record, "address_state"),
      for_self: typeof forSelf === "boolean" ? forSelf : undefined,
      pre_signup_answers: answers,
      selected_treatment: stringValue(record, "selected_treatment"),
      treatment_answers: treatmentAnswers,
    };

    return isPreAuthIntakeComplete(data) ? data : null;
  } catch {
    return null;
  }
}

export function isPreAuthIntakeComplete(data: PreAuthIntakeData): boolean {
  return Boolean(
    data.legal_first_name?.trim() &&
      data.legal_last_name?.trim() &&
      data.date_of_birth?.trim() &&
      data.gender?.trim() &&
      (data.service_state?.trim() || data.address_state?.trim()) &&
      data.for_self === true,
  );
}

export function serializePreAuthIntake(data: PreAuthIntakeData): string {
  const state = data.service_state?.trim() || data.address_state?.trim() || "";
  return JSON.stringify({
    legal_first_name: data.legal_first_name?.trim() ?? "",
    legal_last_name: data.legal_last_name?.trim() ?? "",
    date_of_birth: data.date_of_birth?.trim() ?? "",
    gender: data.gender?.trim() ?? "",
    service_state: state,
    address_state: state,
    for_self: data.for_self,
    pre_signup_answers: data.pre_signup_answers ?? {},
    selected_treatment: data.selected_treatment ?? "",
    treatment_answers: data.treatment_answers ?? {},
  });
}

function stringAnswer(
  answers: IntakeQuestionAnswers,
  key: keyof Pick<
    PreAuthIntakeData,
    "legal_first_name" | "legal_last_name" | "date_of_birth" | "gender" | "service_state"
  >,
): string {
  const value = answers[key];
  return typeof value === "string" ? value.trim() : "";
}

export function buildPreAuthIntakeData(
  questions: Pick<IntakeQuestion, "question_key" | "question_type">[],
  answers: IntakeQuestionAnswers,
  treatment?: {
    selectedTreatment?: TreatmentKey | string | null;
    questions?: Pick<IntakeQuestion, "question_key" | "question_type">[];
    answers?: IntakeQuestionAnswers;
  },
): PreAuthIntakeData {
  const state = stringAnswer(answers, "service_state");
  return {
    legal_first_name: stringAnswer(answers, "legal_first_name"),
    legal_last_name: stringAnswer(answers, "legal_last_name"),
    date_of_birth: stringAnswer(answers, "date_of_birth"),
    gender: stringAnswer(answers, "gender"),
    service_state: state,
    address_state: state,
    for_self: answers.for_self === "yes",
    pre_signup_answers: normalizeIntakeAnswers(questions, answers),
    selected_treatment: treatment?.selectedTreatment ?? "",
    treatment_answers: normalizeIntakeAnswers(
      treatment?.questions ?? [],
      treatment?.answers ?? {},
    ),
  };
}
