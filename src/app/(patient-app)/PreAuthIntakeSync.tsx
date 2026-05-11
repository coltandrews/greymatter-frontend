"use client";

import { syncStoredPreAuthIntake } from "@/lib/intake/syncStoredPreAuthIntake";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export function PreAuthIntakeSync() {
  useEffect(() => {
    let cancelled = false;

    async function syncPreAuthIntake() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        return;
      }

      await syncStoredPreAuthIntake(supabase, user.id);
    }

    void syncPreAuthIntake();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
