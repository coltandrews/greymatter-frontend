"use client";

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  createBookingIntent,
  createBookingIntentCheckout,
} from "@/lib/api/bookingIntents";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { syncStoredPreAuthIntake } from "@/lib/intake/syncStoredPreAuthIntake";
import { buildTreatmentBookingIntentPayload } from "@/lib/scheduling/bookingIntentPayload";
import { createClient } from "@/lib/supabase/client";
import { treatmentByKey } from "@/lib/treatments";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./checkout.module.css";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type CheckoutState = {
  bookingIntentId: string;
  checkoutSessionId: string | null;
  clientSecret: string;
};

function responseErrorMessage(prefix: string, res: Response): Promise<string> {
  return res.text().then((raw) => {
    if (!raw.trim()) {
      return `${prefix} failed (${res.status}).`;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        const message =
          typeof obj.message === "string"
            ? obj.message
            : typeof obj.error === "string"
              ? obj.error
              : raw;
        return `${prefix} failed (${res.status}): ${message}`;
      }
    } catch {
      // Use raw response below.
    }
    return `${prefix} failed (${res.status}): ${raw}`;
  });
}

export function TreatmentCheckout({
  initialDraft,
  initialProfile,
}: {
  initialDraft: IntakeDraftData | null;
  initialProfile: IntakeDraftData | null;
}) {
  const [intake, setIntake] = useState(() =>
    mergeIntakeAndProfileDemographics(initialDraft, initialProfile),
  );
  const [loadingIntake, setLoadingIntake] = useState(true);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncAndLoad() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      await syncStoredPreAuthIntake(supabase, user.id);
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

      if (!cancelled) {
        setIntake(
          mergeIntakeAndProfileDemographics(
            (draftRow?.data ?? null) as IntakeDraftData | null,
            (profile?.demographics ?? null) as IntakeDraftData | null,
          ),
        );
        setLoadingIntake(false);
      }
    }

    void syncAndLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  const treatment = useMemo(
    () => treatmentByKey(intake.selected_treatment),
    [intake.selected_treatment],
  );

  async function startCheckout() {
    setError(null);
    setLoadingCheckout(true);
    try {
      if (!treatment) {
        throw new Error("Choose a treatment before checkout.");
      }
      if (!stripePublishableKey) {
        throw new Error("Payment is not configured yet.");
      }

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to continue to payment.");
      }

      const bookingRes = await createBookingIntent(
        session.access_token,
        buildTreatmentBookingIntentPayload(intake),
      );
      if (!bookingRes.ok) {
        throw new Error(await responseErrorMessage("Medication request", bookingRes));
      }

      const bookingJson = (await bookingRes.json().catch(() => ({}))) as Record<string, unknown>;
      const bookingIntent =
        bookingJson.bookingIntent && typeof bookingJson.bookingIntent === "object"
          ? (bookingJson.bookingIntent as Record<string, unknown>)
          : null;
      const bookingIntentId =
        typeof bookingIntent?.id === "string" ? bookingIntent.id : "";
      if (!bookingIntentId) {
        throw new Error("Could not prepare this medication request for payment.");
      }

      const checkoutRes = await createBookingIntentCheckout(
        session.access_token,
        bookingIntentId,
        { embedded: true },
      );
      if (!checkoutRes.ok) {
        throw new Error(await responseErrorMessage("Checkout", checkoutRes));
      }

      const checkoutJson = (await checkoutRes.json().catch(() => ({}))) as Record<string, unknown>;
      const clientSecret =
        typeof checkoutJson.clientSecret === "string"
          ? checkoutJson.clientSecret
          : "";
      if (!clientSecret) {
        throw new Error("Embedded checkout is not available yet. Please try again in a moment.");
      }

      setCheckout({
        bookingIntentId,
        checkoutSessionId:
          typeof checkoutJson.checkoutSessionId === "string"
            ? checkoutJson.checkoutSessionId
            : null,
        clientSecret,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setLoadingCheckout(false);
    }
  }

  function onCheckoutComplete() {
    const checkoutSessionId = checkout?.checkoutSessionId;
    window.location.assign(
      checkoutSessionId
        ? `/schedule/confirmed?checkout_session_id=${encodeURIComponent(checkoutSessionId)}`
        : "/hub",
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <img src="/brand/gmmd-intake-logo.png" alt="GMMD" className={styles.logo} />
          <h1 className={styles.title}>Review payment</h1>
        </header>

        <div className={styles.grid}>
          <section className={styles.panel} aria-labelledby="purchase-title">
            <h2 id="purchase-title" className={styles.sectionTitle}>
              Purchase summary
            </h2>
            {loadingIntake ? (
              <p className={styles.muted}>Loading your intake...</p>
            ) : treatment ? (
              <>
                <p className={styles.treatmentName}>{treatment.name}</p>
                <p className={styles.muted}>{treatment.priceLabel}</p>
              </>
            ) : (
              <>
                <p className={styles.muted}>
                  We could not find a selected treatment on your saved intake.
                </p>
                <div className={styles.actions}>
                  <Link href="/" className={styles.secondary}>
                    Return to intake
                  </Link>
                </div>
              </>
            )}
          </section>

          {!checkout ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                disabled={!treatment || loadingCheckout || loadingIntake}
                onClick={() => void startCheckout()}
              >
                {loadingCheckout ? "Preparing payment..." : "Continue to payment"}
              </button>
            </div>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>

        {checkout ? (
          <section className={styles.panel} aria-labelledby="payment-title">
            <h2 id="payment-title" className={styles.sectionTitle}>
              Payment
            </h2>
            <div className={styles.checkoutFrame}>
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  clientSecret: checkout.clientSecret,
                  onComplete: onCheckoutComplete,
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
