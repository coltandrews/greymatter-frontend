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
    .select("id, booking_status, payment_status, ola_status, ola_redirect_url, failure_reason, intake_data, selected_slot")
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as BookingIntentReturnRow | null;
}

function phoneLast4(bookingIntent: BookingIntentReturnRow | null): string | null {
  const intake =
    bookingIntent?.intake_data && typeof bookingIntent.intake_data === "object"
      ? (bookingIntent.intake_data as Record<string, unknown>)
      : null;
  const rawPhone = typeof intake?.phone === "string" ? intake.phone : "";
  const digits = rawPhone.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
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
  const phoneEnding = phoneLast4(bookingIntent);
  const reviewNote =
    bookingIntent?.booking_status === "needs_review" && bookingIntent.ola_status !== "failed"
      ? `Payment received. Provider review is in progress${
          phoneEnding ? ` for the phone number ending in ${phoneEnding}` : ""
        }. You can track this request in My Treatments.`
      : null;

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
        if (!response.ok && response.status !== 409 && response.status !== 502) {
          throw new Error("Could not sync payment status.");
        }

        const latest = await loadBookingIntentByCheckoutSession(checkoutSessionId);
        setBookingIntent(latest);
        setPollError(null);
      } catch {
        setPollError("Payment is confirmed. We are syncing your medication request status.");
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
      <header className={styles.flowHeader}>
        <img src="/brand/logo-square.svg" alt="GMMD" className={styles.logo} />
      </header>
      <div className={`${styles.icon} ${styles[view.tone]}`} aria-hidden>
        {view.icon}
      </div>
      <h1 className={styles.title}>{view.title}</h1>
      <p className={styles.lead}>{view.lead}</p>
      {reviewNote ? <p className={styles.summary}>{reviewNote}</p> : null}
      {pollError ? <p className={styles.summary}>{pollError}</p> : null}
      {polling && pollCount < MAX_POLLS ? (
        <div className={styles.processingBlock} role="status">
          <span className={styles.processingIndicator} aria-hidden="true" />
          <span>Checking for updates...</span>
        </div>
      ) : (
        <p className={styles.statusNote} aria-hidden="true" />
      )}
      <div className={`${styles.actions} ${!polling ? styles.actionsReady : ""}`}>
        <Link
          href="/hub"
          className={`${styles.btn} ${action ? styles.secondaryBtn : ""}`}
        >
          View My Treatments
        </Link>
        {action ? (
          <Link href={action.href} className={styles.btn}>
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
