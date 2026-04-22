import type { IntakeDraftData } from "@/lib/intake/draftData";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Persist intake-shaped demographics on `profiles.demographics` (jsonb).
 * Call after any successful `intake_drafts` upsert so the profile stays the durable copy.
 */
export async function syncProfileDemographics(
  supabase: SupabaseClient,
  userId: string,
  data: IntakeDraftData,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("profiles")
    .update({ demographics: data })
    .eq("id", userId);

  return { error: error?.message ?? null };
}
