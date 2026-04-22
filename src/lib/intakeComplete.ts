/** Intake questionnaire is finished; further steps (e.g. scheduling) are separate flows. */
export function isIntakeComplete(draftStep: string | null | undefined): boolean {
  return draftStep === "paused_before_scheduling";
}
