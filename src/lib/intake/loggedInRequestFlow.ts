import type { IntakeDraftData } from "@/lib/intake/draftData";
import { isPreAuthIntakeComplete } from "@/lib/intake/preAuthIntake";

export function shouldStartAtMedicationSelection({
  initialPatientData,
  isAuthenticated,
  requestedNewMedication,
}: {
  initialPatientData: IntakeDraftData | null | undefined;
  isAuthenticated: boolean;
  requestedNewMedication: boolean;
}): boolean {
  return Boolean(
    isAuthenticated &&
      requestedNewMedication &&
      initialPatientData &&
      isPreAuthIntakeComplete(initialPatientData),
  );
}

export function shouldRedirectAuthenticatedRootToHub({
  isAuthenticated,
  requestedNewMedication,
}: {
  isAuthenticated: boolean;
  requestedNewMedication: boolean;
}): boolean {
  return isAuthenticated && !requestedNewMedication;
}
