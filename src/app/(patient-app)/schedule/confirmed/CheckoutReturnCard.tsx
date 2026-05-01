"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  checkoutReturnAction,
  checkoutReturnView,
  shouldPollCheckoutReturn,
  type BookingIntentReturnRow,
} from "@/lib/scheduling/checkoutReturn";
import { createClient } from "@/lib/supabase/client";
import styles from "./confirmed.module.css";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 15;

export function CheckoutReturnCard({
  checkoutSessionId,
  initialBookingIntent,
}: {
  checkoutSessionId: string;
  initialBookingIntent: BookingIntentReturnRow | null;
}) {
  const [bookingIntent, setBookingIntent] =
    useState<BookingIntentReturnRow | null>(initialBookingIntent);
  const [pollCount, setPollCount] = useState(0);
  const [pollError, setPollError] = useState<string | null>(null);
  const view = useMemo(() => checkoutReturnView(bookingIntent), [bookingIntent]);
  const action = useMemo(() => checkoutReturnAction(bookingIntent), [bookingIntent]);
  const polling = Boolean(checkoutSessionId) && shouldPollCheckoutReturn(bookingIntent);

  useEffect(() => {
    if (!polling || pollCount >= MAX_POLLS) {
      return;
    }

    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from("booking_intents")
            .select("id, booking_status, payment_status, ola_status, ola_redirect_url, selected_slot")
            .eq("stripe_checkout_session_id", checkoutSessionId)
            .maybeSingle();

          if (error) {
            throw new Error(error.message);
          }

          setBookingIntent(data as BookingIntentReturnRow | null);
          setPollError(null);
        } catch {
          setPollError("Status is taking longer than expected. Check your hub for updates.");
        } finally {
          setPollCount((current) => current + 1);
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [checkoutSessionId, pollCount, polling]);

  return (
    <div className={styles.card}>
      <div className={`${styles.icon} ${styles[view.tone]}`} aria-hidden>
        {view.icon}
      </div>
      <h1 className={styles.title}>{view.title}</h1>
      <p className={styles.lead}>{view.lead}</p>
      <p className={styles.summary}>{view.summary}</p>
      <p className={styles.hint}>{pollError ?? view.hint}</p>
      {polling && pollCount < MAX_POLLS ? (
        <p className={styles.statusNote} role="status">
          Checking for booking updates...
        </p>
      ) : null}
      <div className={styles.actions}>
        {action ? (
          <Link href={action.href} className={styles.btn}>
            {action.label}
          </Link>
        ) : null}
        <Link
          href="/hub"
          className={`${styles.btn} ${action ? styles.secondaryBtn : ""}`}
        >
          Back to Patient Hub
        </Link>
      </div>
    </div>
  );
}
