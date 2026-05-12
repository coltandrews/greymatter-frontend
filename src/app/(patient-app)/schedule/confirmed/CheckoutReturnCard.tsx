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

type StatusRow = {
  label: string;
  value: string;
  state: "complete" | "current" | "pending" | "attention";
};

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

function statusRows(bookingIntent: BookingIntentReturnRow | null): StatusRow[] {
  const paid = bookingIntent?.payment_status === "paid";
  const booked =
    bookingIntent?.booking_status === "booked" &&
    bookingIntent?.ola_status === "booked";
  const actionRequired = bookingIntent?.booking_status === "action_required";
  const underReview = bookingIntent?.booking_status === "needs_review";

  return [
    {
      label: "Payment",
      value: paid ? "Received" : "Pending",
      state: paid ? "complete" : "current",
    },
    {
      label: "Provider review",
      value: booked
        ? "Submitted"
        : actionRequired
          ? "Next steps ready"
          : underReview
            ? "Under review"
            : paid
              ? "Processing"
              : "Pending",
      state: booked
        ? "complete"
        : actionRequired
          ? "current"
          : underReview
            ? "attention"
            : paid
              ? "current"
              : "pending",
    },
    {
      label: "Updates",
      value: paid ? "SMS and email" : "After payment",
      state: paid ? "pending" : "pending",
    },
  ];
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
  const rows = useMemo(() => statusRows(bookingIntent), [bookingIntent]);

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
      <div className={`${styles.icon} ${styles[view.tone]}`} aria-hidden>
        {view.icon}
      </div>
      <h1 className={styles.title}>{view.title}</h1>
      <p className={styles.lead}>{view.lead}</p>
      <p className={styles.summary}>{pollError ?? view.summary}</p>
      {polling && pollCount < MAX_POLLS ? (
        <p className={styles.statusNote} role="status">
          Checking for updates...
        </p>
      ) : null}
      <dl className={styles.statusList} aria-label="Request status">
        {rows.map((row) => (
          <div key={row.label} className={styles.statusRow}>
            <dt>{row.label}</dt>
            <dd>
              <span
                className={`${styles.statusDot} ${styles[`status${row.state}`]}`}
                aria-hidden="true"
              />
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <Link
          href="/hub"
          className={`${styles.btn} ${action ? styles.secondaryBtn : ""}`}
        >
          Continue to portal
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
