import type { IntakeDraftData } from "@/lib/intake/draftData";

/**
 * Merge draft + profile demographics; profile (saved) values win over draft for overlapping keys.
 */
export function mergeIntakeAndProfileDemographics(
  draft: IntakeDraftData | null | undefined,
  profile: IntakeDraftData | null | undefined,
): IntakeDraftData {
  return {
    ...(draft ?? {}),
    ...(profile ?? {}),
  };
}
