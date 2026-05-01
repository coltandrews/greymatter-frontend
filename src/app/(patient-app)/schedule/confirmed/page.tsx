import Link from "next/link";
import { checkoutReturnView, type BookingIntentReturnRow } from "@/lib/scheduling/checkoutReturn";
import { createClient } from "@/lib/supabase/server";
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

  const view = checkoutReturnView(bookingIntent);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={`${styles.icon} ${styles[view.tone]}`} aria-hidden>
          {view.icon}
        </div>
        <h1 className={styles.title}>{view.title}</h1>
        <p className={styles.lead}>{view.lead}</p>
        <p className={styles.summary}>{view.summary}</p>
        <p className={styles.hint}>{view.hint}</p>
        <Link href="/hub" className={styles.btn}>
          Back to Patient Hub
        </Link>
      </div>
    </main>
  );
}
