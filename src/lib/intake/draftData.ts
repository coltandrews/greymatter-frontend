/**
 * Patient demographics + eligibility fields stored in `intake_drafts.data` and mirrored on
 * `profiles.demographics` (durable profile). Merge with {@link mergeIntakeAndProfileDemographics}
 * when reading; after writes, call {@link syncProfileDemographics}.
 */

export type DraftGender = "male" | "female" | "non_binary" | "prefer_not";

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
};

const GENDERS: readonly string[] = ["male", "female", "non_binary", "prefer_not"];

export function isDraftGender(v: string): v is DraftGender {
  return GENDERS.includes(v);
}

/** Legal name, DOB, gender (intake step 1). */
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

/** Full demographics before eligibility (identity + contact). */
export function basicInfoComplete(d: IntakeDraftData | undefined): boolean {
  return demographicsIdentityComplete(d) && demographicsContactComplete(d);
}
