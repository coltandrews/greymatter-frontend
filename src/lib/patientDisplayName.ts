import type { User } from "@supabase/supabase-js";
import type { IntakeDraftData } from "@/lib/intake/draftData";

function titleFirstWord(label: string): string {
  const first = label.trim().split(/\s+/)[0] || label.trim();
  if (!first) {
    return "";
  }
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * Label for “Welcome, …” in the patient header.
 * Prefers name from intake draft (preferred / legal first), then OAuth metadata, then email.
 */
export function patientWelcomeName(
  user: User,
  draft?: IntakeDraftData | null,
): string {
  const preferred = draft?.preferred_name?.trim();
  const legalFirst = draft?.legal_first_name?.trim();
  if (preferred) {
    return titleFirstWord(preferred);
  }
  if (legalFirst) {
    return titleFirstWord(legalFirst);
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const named =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    "";

  if (named) {
    return titleFirstWord(named);
  }

  if (user.email?.trim()) {
    const local = user.email.trim().split("@")[0] ?? "";
    if (local) {
      return titleFirstWord(local.replace(/[._-]+/g, " "));
    }
    return user.email.trim();
  }

  return "there";
}
