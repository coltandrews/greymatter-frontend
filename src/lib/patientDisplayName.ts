import type { User } from "@supabase/supabase-js";

/** First name (or email local-part) for “Welcome, …” in the patient header. */
export function patientWelcomeName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const raw =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    (user.email ? user.email.split("@")[0] : "") ||
    "there";
  const first = raw.split(/\s+/)[0] || "there";
  const lower = first.toLowerCase();
  return lower === "there" ? "there" : first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
