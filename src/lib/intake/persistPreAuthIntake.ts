import type { IntakeDraftData } from "@/lib/intake/draftData";
import { syncProfileDemographics } from "@/lib/intake/syncProfileDemographics";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function persistPreAuthIntake(
  supabase: SupabaseClient,
  userId: string,
  data: IntakeDraftData,
): Promise<{ error: string | null }> {
  const { error: upsertError } = await supabase.from("intake_drafts").upsert(
    {
      user_id: userId,
      step: "paused_before_scheduling",
      data,
    },
    { onConflict: "user_id" },
  );
  if (upsertError) {
    return { error: upsertError.message };
  }

  const { error: syncError } = await syncProfileDemographics(supabase, userId, data);
  if (syncError) {
    return { error: syncError };
  }

  const { data: rows, error: selectError } = await supabase
    .from("submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .limit(1);
  if (selectError) {
    return { error: selectError.message };
  }
  if (rows && rows.length > 0) {
    return { error: null };
  }

  const { error: insertError } = await supabase.from("submissions").insert({
    user_id: userId,
    status: "in_progress",
  });

  return { error: insertError?.message ?? null };
}
