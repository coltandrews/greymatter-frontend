"use client";

import {
  PRE_AUTH_INTAKE_STORAGE_KEY,
  parsePreAuthIntake,
} from "@/lib/intake/preAuthIntake";
import { persistPreAuthIntake } from "@/lib/intake/persistPreAuthIntake";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export function PreAuthIntakeSync() {
  useEffect(() => {
    let cancelled = false;

    async function syncPreAuthIntake() {
      const preAuthIntake = parsePreAuthIntake(
        window.localStorage.getItem(PRE_AUTH_INTAKE_STORAGE_KEY),
      );
      if (!preAuthIntake) {
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        return;
      }

      const { error } = await persistPreAuthIntake(supabase, user.id, preAuthIntake);
      if (!error && !cancelled) {
        window.localStorage.removeItem(PRE_AUTH_INTAKE_STORAGE_KEY);
      }
    }

    void syncPreAuthIntake();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
