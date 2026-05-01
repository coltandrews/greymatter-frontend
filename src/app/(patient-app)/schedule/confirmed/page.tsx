import type { BookingIntentReturnRow } from "@/lib/scheduling/checkoutReturn";
import { createClient } from "@/lib/supabase/server";
import { CheckoutReturnCard } from "./CheckoutReturnCard";
import styles from "./confirmed.module.css";

type Props = {
  searchParams: Promise<{ checkout_session_id?: string }>;
};

export default async function ScheduleConfirmedPage({ searchParams }: Props) {
  const sp = await searchParams;
  const checkoutSessionId =
    typeof sp.checkout_session_id === "string" ? sp.checkout_session_id.trim() : "";

  let bookingIntent: BookingIntentReturnRow | null = null;
  if (checkoutSessionId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("booking_intents")
      .select("booking_status, payment_status, ola_status, selected_slot")
      .eq("stripe_checkout_session_id", checkoutSessionId)
      .maybeSingle();
    bookingIntent = data as BookingIntentReturnRow | null;
  }

  return (
    <main className={styles.page}>
      <CheckoutReturnCard
        checkoutSessionId={checkoutSessionId}
        initialBookingIntent={bookingIntent}
      />
    </main>
  );
}
