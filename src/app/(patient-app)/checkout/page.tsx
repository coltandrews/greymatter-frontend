import type { IntakeDraftData } from "@/lib/intake/draftData";
import { createClient } from "@/lib/supabase/server";
import { TreatmentCheckout } from "./TreatmentCheckout";

type Props = {
  searchParams: Promise<{ booking_intent_id?: string }>;
};

export default async function CheckoutPage({ searchParams }: Props) {
  const sp = await searchParams;
  const bookingIntentId =
    typeof sp.booking_intent_id === "string" ? sp.booking_intent_id.trim() : "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: draftRow }, { data: profile }, { data: bookingIntent }] = await Promise.all([
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
    bookingIntentId
      ? supabase
          .from("booking_intents")
          .select("id, intake_data, payment_status")
          .eq("id", bookingIntentId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const resumableBookingIntent =
    bookingIntent?.payment_status === "paid" ? null : bookingIntent;

  return (
    <TreatmentCheckout
      initialDraft={
        (resumableBookingIntent?.intake_data ?? draftRow?.data ?? null) as IntakeDraftData | null
      }
      initialProfile={(profile?.demographics ?? null) as IntakeDraftData | null}
      resumeBookingIntentId={resumableBookingIntent?.id ?? null}
    />
  );
}
