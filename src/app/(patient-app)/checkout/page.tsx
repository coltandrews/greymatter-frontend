import type { IntakeDraftData } from "@/lib/intake/draftData";
import { createClient } from "@/lib/supabase/server";
import { TreatmentCheckout } from "./TreatmentCheckout";

export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: draftRow }, { data: profile }] = await Promise.all([
    supabase
      .from("intake_drafts")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("demographics")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  return (
    <TreatmentCheckout
      initialDraft={(draftRow?.data ?? null) as IntakeDraftData | null}
      initialProfile={(profile?.demographics ?? null) as IntakeDraftData | null}
    />
  );
}
