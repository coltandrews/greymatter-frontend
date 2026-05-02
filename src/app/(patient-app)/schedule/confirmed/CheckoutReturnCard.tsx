"use client";

import { reconcileCheckoutSession } from "@/lib/api/bookingIntents";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkoutReturnAction,
  checkoutReturnView,
  shouldPollCheckoutReturn,
  type BookingIntentReturnRow,
} from "@/lib/scheduling/checkoutReturn";
import { patientBookingTimeline } from "@/lib/scheduling/patientTimeline";
import { createClient } from "@/lib/supabase/client";
import styles from "./confirmed.module.css";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 15;

async function loadBookingIntentByCheckoutSession(
  checkoutSessionId: string,
): Promise<BookingIntentReturnRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("booking_intents")
    .select("id, booking_status, payment_status, ola_status, ola_redirect_url, selected_slot")
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as BookingIntentReturnRow | null;
}

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
  const reconcileAttempted = useRef(false);
  const view = useMemo(() => checkoutReturnView(bookingIntent), [bookingIntent]);
  const action = useMemo(() => checkoutReturnAction(bookingIntent), [bookingIntent]);
  const polling = Boolean(checkoutSessionId) && shouldPollCheckoutReturn(bookingIntent);
  const timeline = useMemo(
    () =>
      bookingIntent
        ? patientBookingTimeline({
            booking_status: bookingIntent.booking_status,
            payment_status: bookingIntent.payment_status,
            ola_status: bookingIntent.ola_status,
            has_next_steps: Boolean(bookingIntent.ola_redirect_url),
          })
        : [],
    [bookingIntent],
  );

  useEffect(() => {
    if (!checkoutSessionId || !polling || reconcileAttempted.current) {
      return;
    }

    reconcileAttempted.current = true;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          return;
        }

        const response = await reconcileCheckoutSession(
          session.access_token,
          checkoutSessionId,
        );
        if (!response.ok && response.status !== 409) {
          throw new Error("Could not sync Stripe checkout status.");
        }

        const latest = await loadBookingIntentByCheckoutSession(checkoutSessionId);
        setBookingIntent(latest);
        setPollError(null);
      } catch {
        setPollError("Payment is confirmed in Stripe. We are syncing your appointment status.");
      }
    })();
  }, [checkoutSessionId, polling]);

  useEffect(() => {
    if (!polling || pollCount >= MAX_POLLS) {
      return;
    }

    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const latest = await loadBookingIntentByCheckoutSession(checkoutSessionId);
          setBookingIntent(latest);
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
      {bookingIntent ? (
        <>
          <ol className={styles.timeline} aria-label="Booking progress">
            {timeline.map((step) => (
              <li
                key={step.key}
                className={`${styles.timelineItem} ${styles[`timeline${step.state}`]}`}
              >
                <span className={styles.timelineMarker} aria-hidden="true" />
                <span className={styles.timelineText}>
                  <span className={styles.timelineLabel}>{step.label}</span>
                  <span className={styles.timelineDescription}>
                    {step.description}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <dl className={styles.requestDetails}>
            <div>
              <dt>Request ID</dt>
              <dd className={styles.mono}>{bookingIntent.id}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{bookingIntent.payment_status ?? "Pending"}</dd>
            </div>
            <div>
              <dt>Provider booking</dt>
              <dd>{bookingIntent.ola_status ?? "Pending"}</dd>
            </div>
          </dl>
        </>
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
