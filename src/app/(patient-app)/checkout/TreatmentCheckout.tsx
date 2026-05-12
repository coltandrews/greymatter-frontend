"use client";

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { US_STATES } from "@/app/intake/usStates";
import {
  createBookingIntent,
  createBookingIntentCheckout,
} from "@/lib/api/bookingIntents";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { syncStoredPreAuthIntake } from "@/lib/intake/syncStoredPreAuthIntake";
import { syncProfileDemographics } from "@/lib/intake/syncProfileDemographics";
import { buildTreatmentBookingIntentPayload } from "@/lib/scheduling/bookingIntentPayload";
import { createClient } from "@/lib/supabase/client";
import { treatmentByKey } from "@/lib/treatments";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./checkout.module.css";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;
const ID_BUCKET = "patient-documents";
const ID_MAX_BYTES = 10 * 1024 * 1024;
const ID_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

type CheckoutState = {
  bookingIntentId: string;
  checkoutSessionId: string | null;
  clientSecret: string;
};

type CheckoutStep = "address" | "id" | "payment";

type ShippingForm = {
  street_address: string;
  address_line2: string;
  city: string;
  address_state: string;
  zip: string;
};

function shippingFromDraft(data: IntakeDraftData | null): ShippingForm {
  return {
    street_address: data?.street_address?.trim() ?? "",
    address_line2: data?.address_line2?.trim() ?? "",
    city: data?.city?.trim() ?? "",
    address_state: data?.address_state?.trim() || data?.service_state?.trim() || "",
    zip: data?.zip?.trim() ?? "",
  };
}

function shippingPatch(form: ShippingForm): IntakeDraftData {
  const state = form.address_state.trim();
  return {
    street_address: form.street_address.trim(),
    address_line2: form.address_line2.trim(),
    city: form.city.trim(),
    address_state: state,
    service_state: state,
    zip: form.zip.trim(),
    country: "US",
  };
}

function shippingComplete(form: ShippingForm): boolean {
  return Boolean(
    form.street_address.trim() &&
      form.city.trim() &&
      form.address_state.trim() &&
      form.zip.trim(),
  );
}

function shippingKey(form: ShippingForm): string {
  const patch = shippingPatch(form);
  return [
    patch.street_address,
    patch.address_line2,
    patch.city,
    patch.address_state,
    patch.zip,
  ].join("|");
}

function idFileExtension(file: File): string {
  if (file.type === "application/pdf") {
    return "pdf";
  }
  if (file.type === "image/png") {
    return "png";
  }
  return "jpg";
}

function validateIdFile(file: File | null): string | null {
  if (!file) {
    return "Upload a government ID.";
  }
  if (!ID_MIME_TYPES.has(file.type)) {
    return "Use a JPG, PNG, or PDF.";
  }
  if (file.size <= 0 || file.size > ID_MAX_BYTES) {
    return "File must be 10 MB or less.";
  }
  return null;
}

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shippingSummary(form: ShippingForm): string {
  return [
    form.street_address.trim(),
    form.address_line2.trim(),
    [form.city.trim(), form.address_state.trim(), form.zip.trim()].filter(Boolean).join(", "),
  ].filter(Boolean).join(" ");
}

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
  const [shipping, setShipping] = useState<ShippingForm>(() =>
    shippingFromDraft(mergeIntakeAndProfileDemographics(initialDraft, initialProfile)),
  );
  const [loadingIntake, setLoadingIntake] = useState(true);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkoutShippingKey, setCheckoutShippingKey] = useState<string | null>(null);
  const [step, setStep] = useState<CheckoutStep>("address");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
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
        const merged = mergeIntakeAndProfileDemographics(
          (draftRow?.data ?? null) as IntakeDraftData | null,
          (profile?.demographics ?? null) as IntakeDraftData | null,
        );
        setIntake(merged);
        setShipping(shippingFromDraft(merged));
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
  const isShippingComplete = shippingComplete(shipping);
  const activeShippingKey = shippingKey(shipping);
  const idFileError = validateIdFile(idFile);
  const paymentReady = isShippingComplete && !idFileError;

  function updateShipping(key: keyof ShippingForm, value: string) {
    setShipping((current) => ({ ...current, [key]: value }));
    setCheckout(null);
    setCheckoutShippingKey(null);
    setError(null);
  }

  function updateIdFile(file: File | null) {
    const validationError = validateIdFile(file);
    setIdFile(file);
    setIdError(file ? validationError : null);
    setCheckout(null);
    setCheckoutShippingKey(null);
    setError(null);
  }

  function continueFromAddress() {
    setError(null);
    if (!shippingComplete(shipping)) {
      setError("Enter your shipping address.");
      return;
    }
    setStep("id");
  }

  function continueFromId() {
    const validationError = validateIdFile(idFile);
    setIdError(validationError);
    setError(null);
    if (validationError) {
      return;
    }
    setStep("payment");
  }

  async function saveGovernmentIdDocument({
    bookingIntentId,
    file,
    userId,
  }: {
    bookingIntentId: string;
    file: File;
    userId: string;
  }) {
    const supabase = createClient();
    const storagePath = `${userId}/${bookingIntentId}/government-id.${idFileExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from(ID_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      });
    if (uploadError) {
      throw new Error(`Could not upload ID: ${uploadError.message}`);
    }

    const { error: documentError } = await supabase
      .from("booking_intent_documents")
      .upsert(
        {
          booking_intent_id: bookingIntentId,
          user_id: userId,
          kind: "government_id",
          storage_path: storagePath,
          mime_type: file.type,
          size_bytes: file.size,
        },
        { onConflict: "booking_intent_id,kind" },
      );
    if (documentError) {
      throw new Error(`Could not save ID upload: ${documentError.message}`);
    }
  }

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
      if (!shippingComplete(shipping)) {
        throw new Error("Enter your shipping address.");
      }
      const file = idFile;
      const validationError = validateIdFile(idFile);
      if (validationError) {
        throw new Error(validationError);
      }
      if (!file) {
        throw new Error("Upload a government ID.");
      }

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to continue to payment.");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Sign in again to continue to payment.");
      }

      const intakeForCheckout: IntakeDraftData = {
        ...intake,
        ...shippingPatch(shipping),
      };
      setIntake(intakeForCheckout);

      const { error: draftError } = await supabase.from("intake_drafts").upsert(
        {
          user_id: user.id,
          step: "checkout",
          data: intakeForCheckout,
        },
        { onConflict: "user_id" },
      );
      if (draftError) {
        throw new Error(draftError.message);
      }

      const { error: profileError } = await syncProfileDemographics(
        supabase,
        user.id,
        intakeForCheckout,
      );
      if (profileError) {
        throw new Error(`Could not save shipping address: ${profileError}`);
      }

      const bookingRes = await createBookingIntent(
        session.access_token,
        buildTreatmentBookingIntentPayload(intakeForCheckout),
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

      await saveGovernmentIdDocument({
        bookingIntentId,
        file,
        userId: user.id,
      });

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
      setCheckoutShippingKey(shippingKey(shipping));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setLoadingCheckout(false);
    }
  }

  useEffect(() => {
    if (
      step !== "payment" ||
      loadingIntake ||
      loadingCheckout ||
      checkout ||
      error ||
      !treatment ||
      !paymentReady ||
      checkoutShippingKey === activeShippingKey
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void startCheckout();
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [
    activeShippingKey,
    checkout,
    checkoutShippingKey,
    error,
    loadingCheckout,
    loadingIntake,
    paymentReady,
    step,
    treatment,
  ]);

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

        <div className={step === "payment" ? styles.grid : styles.singleGrid}>
          {step === "address" ? (
            <section className={styles.panel} aria-labelledby="shipping-title">
              <h2 id="shipping-title" className={styles.sectionTitle}>Shipping address</h2>
              {error ? <p className={styles.error}>{error}</p> : null}
              <label className={styles.field}>
                Address
                <input
                  className={styles.input}
                  value={shipping.street_address}
                  onChange={(event) => updateShipping("street_address", event.target.value)}
                  autoComplete="shipping street-address"
                />
              </label>
              <label className={styles.field}>
                Apt, suite, etc.
                <input
                  className={styles.input}
                  value={shipping.address_line2}
                  onChange={(event) => updateShipping("address_line2", event.target.value)}
                  autoComplete="shipping address-line2"
                />
              </label>
              <div className={styles.addressGrid}>
                <label className={styles.field}>
                  City
                  <input
                    className={styles.input}
                    value={shipping.city}
                    onChange={(event) => updateShipping("city", event.target.value)}
                    autoComplete="shipping address-level2"
                  />
                </label>
                <label className={styles.field}>
                  State
                  <select
                    className={styles.input}
                    value={shipping.address_state}
                    onChange={(event) => updateShipping("address_state", event.target.value)}
                    autoComplete="shipping address-level1"
                  >
                    <option value="">Select</option>
                    {US_STATES.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={styles.field}>
                ZIP
                <input
                  className={styles.input}
                  value={shipping.zip}
                  onChange={(event) => updateShipping("zip", event.target.value)}
                  autoComplete="shipping postal-code"
                  inputMode="numeric"
                />
              </label>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={!isShippingComplete}
                  onClick={continueFromAddress}
                >
                  Continue
                </button>
              </div>
            </section>
          ) : null}

          {step === "id" ? (
            <section className={styles.panel} aria-labelledby="id-title">
              <h2 id="id-title" className={styles.sectionTitle}>Verify identity</h2>
              <label className={styles.uploadBox}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(event) => updateIdFile(event.target.files?.[0] ?? null)}
                />
                <span className={styles.uploadTitle}>
                  {idFile ? idFile.name : "Upload government ID"}
                </span>
                <span className={styles.uploadMeta}>
                  {idFile ? fileSizeLabel(idFile.size) : "JPG, PNG, or PDF up to 10 MB"}
                </span>
              </label>
              {idError ? <p className={styles.error}>{idError}</p> : null}
              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setStep("address")}>
                  Back
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={Boolean(idFileError)}
                  onClick={continueFromId}
                >
                  Continue
                </button>
              </div>
            </section>
          ) : null}

          {step === "payment" ? (
            <section className={styles.panel} aria-labelledby="purchase-title">
              <h2 id="purchase-title" className={styles.sectionTitle}>Payment details</h2>
              {loadingIntake ? (
                <p className={styles.muted}>Loading...</p>
              ) : treatment ? (
                <div className={styles.summaryLine}>
                  <span>{treatment.name}</span>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.muted}>No treatment selected.</p>
                  <Link href="/" className={styles.secondary}>
                    Return to intake
                  </Link>
                </div>
              )}
              <dl className={styles.reviewList}>
                <div>
                  <dt>Shipping</dt>
                  <dd>{shippingSummary(shipping)}</dd>
                </div>
                <div>
                  <dt>ID upload</dt>
                  <dd>{idFile ? idFile.name : "Missing"}</dd>
                </div>
              </dl>
              <button type="button" className={styles.textButton} onClick={() => setStep("id")}>
                Edit details
              </button>
            </section>
          ) : null}

          {step === "payment" ? (
            <section className={styles.panel} aria-labelledby="payment-title">
              <h2 id="payment-title" className={styles.sectionTitle}>Payment</h2>
              {error ? <p className={styles.error}>{error}</p> : null}
              {loadingCheckout || !checkout ? (
                <div className={styles.paymentSkeleton}>Preparing payment...</div>
              ) : checkout ? (
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
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
