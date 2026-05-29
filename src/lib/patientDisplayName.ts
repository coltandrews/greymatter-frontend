import type { User } from "@supabase/supabase-js";
import type { IntakeDraftData } from "@/lib/intake/draftData";

function titleFirstWord(label: string): string {
  const first = label.trim().split(/\s+/)[0] || label.trim();
  if (!first) {
    return "";
  }
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function titleWords(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
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

/**
 * Full patient label for nav/user identity surfaces.
 * Prefers legal first + last name, then metadata full name, then a readable email local part.
 */
export function patientDisplayName(
  user: User,
  draft?: IntakeDraftData | null,
): string {
  const legalFirst = draft?.legal_first_name?.trim();
  const legalLast = draft?.legal_last_name?.trim();
  if (legalFirst && legalLast) {
    return titleWords(`${legalFirst} ${legalLast}`);
  }
  if (legalFirst) {
    return titleWords(legalFirst);
  }

  const preferred = draft?.preferred_name?.trim();
  if (preferred && legalLast) {
    return titleWords(`${preferred} ${legalLast}`);
  }
  if (preferred) {
    return titleWords(preferred);
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const named =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    "";

  if (named) {
    return titleWords(named);
  }

  if (user.email?.trim()) {
    const local = user.email.trim().split("@")[0] ?? "";
    if (local) {
      return titleWords(local.replace(/[._-]+/g, " "));
    }
    return user.email.trim();
  }

  return "there";
}
