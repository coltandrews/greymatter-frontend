"use client";

import {
  PRE_AUTH_INTAKE_STORAGE_KEY,
  parsePreAuthIntake,
} from "@/lib/intake/preAuthIntake";
import { persistPreAuthIntake } from "@/lib/intake/persistPreAuthIntake";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncStoredPreAuthIntake(
  supabase: SupabaseClient,
  userId: string,
  storage: Pick<Storage, "getItem" | "removeItem"> = window.localStorage,
): Promise<{ synced: boolean; error: string | null }> {
  const preAuthIntake = parsePreAuthIntake(
    storage.getItem(PRE_AUTH_INTAKE_STORAGE_KEY),
  );
  if (!preAuthIntake) {
    return { synced: false, error: null };
  }

  const { error } = await persistPreAuthIntake(supabase, userId, preAuthIntake);
  if (error) {
    return { synced: false, error };
  }

  storage.removeItem(PRE_AUTH_INTAKE_STORAGE_KEY);
  return { synced: true, error: null };
}
