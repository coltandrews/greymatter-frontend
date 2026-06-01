/**
 * Patient demographics + eligibility fields stored in `intake_drafts.data` and mirrored on
 * `profiles.demographics` (durable profile). Merge with {@link mergeIntakeAndProfileDemographics}
 * when reading; after writes, call {@link syncProfileDemographics}.
 */

export type DraftGender = "male" | "female";

export type IntakeDraftData = {
  legal_first_name?: string;
  legal_last_name?: string;
  preferred_name?: string;
  date_of_birth?: string;
  gender?: DraftGender | string;
  phone?: string;
  phone_secondary?: string;
  street_address?: string;
  address_line2?: string;
  city?: string;
  address_state?: string;
  zip?: string;
  country?: string;
  for_self?: boolean;
  service_state?: string;
  pre_signup_answers?: Record<string, string | string[]>;
  selected_treatment?: string;
  selected_treatment_question_set?: {
    treatmentKey: string;
    source: string;
    version: string;
  };
  treatment_answers?: Record<string, string | string[]>;
};

const GENDERS: readonly string[] = ["male", "female"];

export function isDraftGender(v: string): v is DraftGender {
  return GENDERS.includes(v);
}

/** Legal name, DOB, sex assigned at birth (intake step 1). */
export function demographicsIdentityComplete(d: IntakeDraftData | undefined): boolean {
  if (!d) {
    return false;
  }
  const strings = [d.legal_first_name, d.legal_last_name, d.date_of_birth, d.gender];
  if (!strings.every((v) => typeof v === "string" && v.trim().length > 0)) {
    return false;
  }
  if (!isDraftGender(String(d.gender).trim())) {
    return false;
  }
  return true;
}

/** Phone + mailing address (intake step 2). */
export function demographicsContactComplete(d: IntakeDraftData | undefined): boolean {
  if (!d) {
    return false;
  }
  const strings = [d.phone, d.street_address, d.city, d.address_state, d.zip];
  if (!strings.every((v) => typeof v === "string" && v.trim().length > 0)) {
    return false;
  }
  const digits = String(d.phone).replace(/\D/g, "");
  if (digits.length < 10) {
    return false;
  }
  return true;
}

/** Account onboarding profile: identity + phone, before any treatment or shipping flow. */
export function memberProfileComplete(d: IntakeDraftData | undefined): boolean {
  if (!demographicsIdentityComplete(d)) {
    return false;
  }
  const digits = String(d?.phone ?? "").replace(/\D/g, "");
  return digits.length >= 10;
}

/** Full demographics before eligibility (identity + contact). */
export function basicInfoComplete(d: IntakeDraftData | undefined): boolean {
  return demographicsIdentityComplete(d) && demographicsContactComplete(d);
}
