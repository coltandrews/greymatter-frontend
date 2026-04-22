/**
 * Intake = HIPAA-appropriate health/eligibility data only (not an appointment).
 * When true, the patient may use the dashboard to schedule and manage care.
 */
export function isIntakeComplete(draftStep: string | null | undefined): boolean {
  return draftStep === "paused_before_scheduling";
}
