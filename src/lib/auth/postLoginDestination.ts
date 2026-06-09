import {
  memberProfileComplete,
  type IntakeDraftData,
} from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";

export type PostLoginDestination = "/dashboard" | "/hub" | "/onboarding";

export function isDashboardRole(role: unknown): role is "staff" | "admin" {
  return role === "staff" || role === "admin";
}

export function postLoginDestination({
  role,
  draftData,
  profileDemographics,
}: {
  role: unknown;
  draftData?: IntakeDraftData | null;
  profileDemographics?: IntakeDraftData | null;
}): PostLoginDestination {
  if (isDashboardRole(role)) {
    return "/dashboard";
  }

  const demographics = mergeIntakeAndProfileDemographics(
    draftData,
    profileDemographics,
  );

  return memberProfileComplete(demographics) ? "/hub" : "/onboarding";
}
