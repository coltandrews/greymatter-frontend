import type { User } from "@supabase/supabase-js";

/**
 * Label for “Welcome, …” in the patient header.
 * Uses profile name from metadata when present; otherwise the full email.
 */
export function patientWelcomeName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const named =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    "";

  if (named) {
    const first = named.split(/\s+/)[0] || named;
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }

  if (user.email?.trim()) {
    return user.email.trim();
  }

  return "there";
}
