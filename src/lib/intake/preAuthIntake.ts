import type { IntakeDraftData } from "./draftData";
import type { IntakeQuestionAnswers } from "./intakeQuestions";

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
};

function stringValue(record: Record<string, unknown>, key: keyof PreAuthIntakeData): string {
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
    const data: PreAuthIntakeData = {
      legal_first_name: stringValue(record, "legal_first_name"),
      legal_last_name: stringValue(record, "legal_last_name"),
      date_of_birth: stringValue(record, "date_of_birth"),
      gender: stringValue(record, "gender"),
      service_state: stringValue(record, "service_state"),
      address_state: stringValue(record, "address_state"),
      for_self: typeof forSelf === "boolean" ? forSelf : undefined,
      pre_signup_answers: answers,
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
  });
}
