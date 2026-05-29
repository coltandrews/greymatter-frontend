"use client";

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AccountProfileForm } from "@/app/(patient-app)/account/AccountProfileForm";
import { SignOutButton } from "@/components/SignOutButton";
import { US_STATES } from "@/app/intake/usStates";
import {
  createBookingIntent,
  createBookingIntentCheckout,
  deleteBookingIntent,
} from "@/lib/api/bookingIntents";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import type {
  IntakeQuestion,
  IntakeQuestionAnswer,
  IntakeQuestionAnswers,
} from "@/lib/intake/intakeQuestions";
import { intakeAnswerComplete } from "@/lib/intake/intakeQuestions";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { syncProfileDemographics } from "@/lib/intake/syncProfileDemographics";
import { buildTreatmentBookingIntentPayload } from "@/lib/scheduling/bookingIntentPayload";
import { hubBookingIntentStatusView } from "@/lib/scheduling/hubBookingStatus";
import { createClient } from "@/lib/supabase/client";
import type { TreatmentProduct } from "@/lib/treatmentProducts";
import { treatmentByKey, visibleTreatmentQuestions } from "@/lib/treatments";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./hub.module.css";
import type { HubAppointmentRow, HubBookingIntentRow } from "./HubAppointments";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;
const ID_BUCKET = "patient-documents";
const ID_MAX_BYTES = 10 * 1024 * 1024;
const ID_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

type HubTab = "treatments" | "new" | "account";
type CheckoutState = {
  bookingIntentId: string;
  checkoutSessionId: string | null;
  clientSecret: string;
};
type ShippingForm = {
  street_address: string;
  address_line2: string;
  city: string;
  address_state: string;
  zip: string;
};
type IdSide = "front" | "back";
type IdUploads = Record<IdSide, File | null>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function currencyFromCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function treatmentName(row: HubBookingIntentRow): string {
  const intake = asRecord(row.intake_data);
  const treatmentKey =
    typeof intake.selected_treatment === "string" ? intake.selected_treatment : null;
  return treatmentByKey(treatmentKey)?.name ?? "Medication request";
}

function patientInitials(name: string, email: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts[0]) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function requestDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function stringAnswer(answer: IntakeQuestionAnswer | undefined): string {
  return typeof answer === "string" ? answer : "";
}

function arrayAnswer(answer: IntakeQuestionAnswer | undefined): string[] {
  return Array.isArray(answer) ? answer : [];
}

function shippingFromIntake(data: IntakeDraftData | null): ShippingForm {
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

function shippingSummary(form: ShippingForm): string {
  return [
    form.street_address.trim(),
    form.address_line2.trim(),
    [form.city.trim(), form.address_state.trim(), form.zip.trim()].filter(Boolean).join(", "),
  ].filter(Boolean).join(" ");
}

function validateIdFile(file: File | null): string | null {
  if (!file) {
    return "Upload the front and back of your government ID.";
  }
  if (!ID_MIME_TYPES.has(file.type)) {
    return "Use a JPG, PNG, or PDF for your ID.";
  }
  if (file.size <= 0 || file.size > ID_MAX_BYTES) {
    return "ID files must be 10 MB or less.";
  }
  return null;
}

function idExtension(file: File): string {
  if (file.type === "application/pdf") {
    return "pdf";
  }
  if (file.type === "image/png") {
    return "png";
  }
  return "jpg";
}

async function responseErrorMessage(prefix: string, res: Response): Promise<string> {
  const raw = await res.text();
  if (!raw.trim()) {
    return `${prefix} failed (${res.status}).`;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const message =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.error === "string"
          ? parsed.error
          : raw;
    return `${prefix} failed (${res.status}): ${message}`;
  } catch {
    return `${prefix} failed (${res.status}): ${raw}`;
  }
}

function ProductQuestionField({
  answer,
  onChange,
  question,
}: {
  answer: IntakeQuestionAnswer | undefined;
  onChange: (value: IntakeQuestionAnswer) => void;
  question: IntakeQuestion;
}) {
  if (question.question_type === "textarea") {
    return (
      <label className={styles.hubField}>
        {question.prompt}
        <textarea
          value={stringAnswer(answer)}
          onChange={(event) => onChange(event.target.value)}
          className={styles.hubTextarea}
        />
      </label>
    );
  }

  if (question.question_type === "select") {
    return (
      <label className={styles.hubField}>
        {question.prompt}
        <select
          value={stringAnswer(answer)}
          onChange={(event) => onChange(event.target.value)}
          className={styles.hubInput}
        >
          <option value="">Select</option>
          {question.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (question.question_type === "multi_select") {
    const selected = arrayAnswer(answer);
    return (
      <fieldset className={styles.hubFieldset}>
        <legend>{question.prompt}</legend>
        <div className={styles.hubOptionGrid}>
          {question.options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className={`${styles.hubOption} ${checked ? styles.hubOptionSelected : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, option.value]
                        : selected.filter((value) => value !== option.value),
                    )
                  }
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (question.question_type === "yes_no") {
    return (
      <fieldset className={styles.hubFieldset}>
        <legend>{question.prompt}</legend>
        <div className={styles.hubOptionGrid}>
          {[
            ["yes", "Yes"],
            ["no", "No"],
          ].map(([value, label]) => {
            const checked = answer === value;
            return (
              <label
                key={value}
                className={`${styles.hubOption} ${checked ? styles.hubOptionSelected : ""}`}
              >
                <input
                  type="radio"
                  name={question.question_key}
                  value={value}
                  checked={checked}
                  onChange={() => onChange(value)}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <label className={styles.hubField}>
      {question.prompt}
      <input
        type={question.question_type === "date" ? "date" : question.question_type === "number" ? "number" : "text"}
        value={stringAnswer(answer)}
        onChange={(event) => onChange(event.target.value)}
        className={styles.hubInput}
      />
    </label>
  );
}

export function PatientHubWorkspace({
  appointments,
  bookingIntents: initialBookingIntents,
  email,
  initialDraft,
  initialProfile,
  initialStep,
  olaUserGuid,
  patientId,
  products,
  serverLoadError,
  welcomeName,
}: {
  appointments: HubAppointmentRow[];
  bookingIntents: HubBookingIntentRow[];
  email: string;
  initialDraft: IntakeDraftData | null;
  initialProfile: IntakeDraftData | null;
  initialStep: string;
  olaUserGuid: string | null;
  patientId: string;
  products: TreatmentProduct[];
  serverLoadError: string | null;
  welcomeName: string;
}) {
  const [activeTab, setActiveTab] = useState<HubTab>("treatments");
  const [bookingIntents, setBookingIntents] = useState(initialBookingIntents);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    initialBookingIntents[0]?.id ?? null,
  );
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);
  const [answers, setAnswers] = useState<IntakeQuestionAnswers>({});
  const mergedIntake = useMemo(
    () => mergeIntakeAndProfileDemographics(initialDraft, initialProfile),
    [initialDraft, initialProfile],
  );
  const [shipping, setShipping] = useState<ShippingForm>(() => shippingFromIntake(mergedIntake));
  const [idUploads, setIdUploads] = useState<IdUploads>({ front: null, back: null });
  const [detailCheckout, setDetailCheckout] = useState<CheckoutState | null>(null);
  const [newCheckout, setNewCheckout] = useState<CheckoutState | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelingBookingId, setCancelingBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(serverLoadError);

  const selectedBooking =
    bookingIntents.find((row) => row.id === selectedBookingId) ?? bookingIntents[0] ?? null;
  const selectedBookingCanceling =
    selectedBooking != null && cancelingBookingId === selectedBooking.id;
  const selectedProduct =
    products.find((product) => product.product_key === selectedProductKey) ?? null;
  const selectedQuestions = useMemo(
    () => visibleTreatmentQuestions(selectedProduct?.question_set_key ?? null, answers),
    [answers, selectedProduct?.question_set_key],
  );
  const productTotal =
    (selectedProduct?.consultation_fee_cents ?? 0) +
    (selectedProduct?.medication_fee_cents ?? 0);
  const allQuestionsComplete = selectedQuestions.every((question) =>
    intakeAnswerComplete(question, answers[question.question_key]),
  );
  const idError = validateIdFile(idUploads.front) ?? validateIdFile(idUploads.back);

  function selectProduct(product: TreatmentProduct) {
    setSelectedProductKey(product.product_key);
    setAnswers({});
    setNewCheckout(null);
    setError(null);
  }

  async function currentSession() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Sign in again to continue.");
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Sign in again to continue.");
    }
    return { supabase, session, user };
  }

  async function saveGovernmentIdDocument({
    bookingIntentId,
    file,
    side,
    userId,
  }: {
    bookingIntentId: string;
    file: File;
    side: IdSide;
    userId: string;
  }) {
    const supabase = createClient();
    const storagePath = `${userId}/${bookingIntentId}/government-id-${side}.${idExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from(ID_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      });
    if (uploadError) {
      throw new Error(`Could not upload the ${side} of your ID.`);
    }

    const { error: documentError } = await supabase
      .from("booking_intent_documents")
      .upsert(
        {
          booking_intent_id: bookingIntentId,
          user_id: userId,
          kind: `government_id_${side}`,
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

  async function openCheckoutForBooking(row: HubBookingIntentRow) {
    setBusy(true);
    setError(null);
    setDetailCheckout(null);
    try {
      if (!stripePublishableKey) {
        throw new Error("Payment is not configured yet.");
      }
      const { session } = await currentSession();
      const response = await createBookingIntentCheckout(session.access_token, row.id, {
        embedded: true,
      });
      if (!response.ok) {
        throw new Error(await responseErrorMessage("Checkout", response));
      }
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const clientSecret = typeof payload.clientSecret === "string" ? payload.clientSecret : "";
      if (!clientSecret) {
        throw new Error("Embedded checkout is not available yet.");
      }
      setDetailCheckout({
        bookingIntentId: row.id,
        checkoutSessionId:
          typeof payload.checkoutSessionId === "string" ? payload.checkoutSessionId : null,
        clientSecret,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open checkout.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelUnpaidBooking(row: HubBookingIntentRow) {
    setCancelingBookingId(row.id);
    setError(null);
    try {
      const { session } = await currentSession();
      const response = await deleteBookingIntent(session.access_token, row.id);
      if (!response.ok && response.status !== 204) {
        throw new Error(await responseErrorMessage("Cancel request", response));
      }
      setBookingIntents((current) => current.filter((item) => item.id !== row.id));
      setSelectedBookingId((current) => (current === row.id ? null : current));
      setDetailCheckout(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel this request.");
    } finally {
      setCancelingBookingId(null);
    }
  }

  async function createNewTreatmentCheckout() {
    setBusy(true);
    setError(null);
    setNewCheckout(null);
    try {
      if (!selectedProduct) {
        throw new Error("Select a treatment.");
      }
      if (!allQuestionsComplete) {
        throw new Error("Answer every required treatment question.");
      }
      if (!shippingComplete(shipping)) {
        throw new Error("Enter your shipping address.");
      }
      if (idError) {
        throw new Error(idError);
      }
      if (!idUploads.front || !idUploads.back) {
        throw new Error("Upload the front and back of your government ID.");
      }
      if (!stripePublishableKey) {
        throw new Error("Payment is not configured yet.");
      }

      const { supabase, session, user } = await currentSession();
      const intakeForCheckout: IntakeDraftData = {
        ...mergedIntake,
        ...shippingPatch(shipping),
        selected_treatment: selectedProduct.product_key,
        selected_treatment_question_set: {
          treatmentKey: selectedProduct.question_set_key,
          source: "ola",
          version: "postgres-product",
        },
        treatment_answers: answers,
      };

      const { error: draftError } = await supabase.from("intake_drafts").upsert(
        {
          user_id: user.id,
          step: "hub_new_treatment",
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
        throw new Error(profileError);
      }

      const bookingResponse = await createBookingIntent(session.access_token, {
        ...buildTreatmentBookingIntentPayload(intakeForCheckout),
        productKey: selectedProduct.product_key,
        serviceKey: selectedProduct.service_key,
        serviceType: selectedProduct.service_type,
      });
      if (!bookingResponse.ok) {
        throw new Error(await responseErrorMessage("Medication request", bookingResponse));
      }
      const bookingPayload = (await bookingResponse.json().catch(() => ({}))) as Record<string, unknown>;
      const bookingIntent =
        bookingPayload.bookingIntent && typeof bookingPayload.bookingIntent === "object"
          ? bookingPayload.bookingIntent as Record<string, unknown>
          : null;
      const bookingIntentId = typeof bookingIntent?.id === "string" ? bookingIntent.id : "";
      if (!bookingIntentId) {
        throw new Error("Could not prepare this medication request.");
      }

      await saveGovernmentIdDocument({
        bookingIntentId,
        file: idUploads.front,
        side: "front",
        userId: user.id,
      });
      await saveGovernmentIdDocument({
        bookingIntentId,
        file: idUploads.back,
        side: "back",
        userId: user.id,
      });

      const checkoutResponse = await createBookingIntentCheckout(
        session.access_token,
        bookingIntentId,
        { embedded: true },
      );
      if (!checkoutResponse.ok) {
        throw new Error(await responseErrorMessage("Checkout", checkoutResponse));
      }
      const checkoutPayload = (await checkoutResponse.json().catch(() => ({}))) as Record<string, unknown>;
      const clientSecret =
        typeof checkoutPayload.clientSecret === "string" ? checkoutPayload.clientSecret : "";
      if (!clientSecret) {
        throw new Error("Embedded checkout is not available yet.");
      }

      setNewCheckout({
        bookingIntentId,
        checkoutSessionId:
          typeof checkoutPayload.checkoutSessionId === "string"
            ? checkoutPayload.checkoutSessionId
            : null,
        clientSecret,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  function selectTab(tab: HubTab) {
    setActiveTab(tab);
    if (tab === "new") {
      setSelectedProductKey(null);
      setAnswers({});
      setNewCheckout(null);
    }
    setError(null);
  }

  function onCheckoutComplete(checkout: CheckoutState | null) {
    window.location.assign(
      checkout?.checkoutSessionId
        ? `/schedule/confirmed?checkout_session_id=${encodeURIComponent(checkout.checkoutSessionId)}`
        : "/hub",
    );
  }

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar} aria-label="Patient navigation">
        <div className={styles.sidebarBrand}>
          <img
            src="/brand/logo-horizontal.svg"
            alt="Greymatter MD"
            className={styles.sidebarLogo}
          />
        </div>

        <div className={styles.sidebarUser}>
          <div className={styles.sidebarAvatar} aria-hidden="true">
            {patientInitials(welcomeName, email)}
          </div>
          <div className={styles.sidebarUserText}>
            <p>{welcomeName}</p>
            <span title={email}>{email}</span>
          </div>
        </div>

        <nav className={styles.sidebarNav} aria-label="Patient hub sections">
          {[
            ["treatments", "My Treatments"],
            ["new", "New Treatment"],
            ["account", "Account"],
          ].map(([key, label]) => {
            const tab = key as HubTab;
            return (
              <button
                key={key}
                type="button"
                aria-current={activeTab === tab ? "page" : undefined}
                className={`${styles.sidebarNavLink} ${
                  activeTab === tab ? styles.sidebarNavLinkActive : ""
                }`}
                onClick={() => selectTab(tab)}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <SignOutButton noMargin />
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.kicker}>Patient portal</p>
            <h1>Patient Hub</h1>
            <p>Track provider review, payment, and medication request status.</p>
          </div>
        </header>

        {error ? <p className={styles.error}>{error}</p> : null}

        {activeTab === "treatments" ? (
          <section className={styles.hubSplit} aria-labelledby="my-treatments-title">
          <div className={styles.panel}>
            <div className={styles.panelHeaderRow}>
              <div>
                <h2 id="my-treatments-title" className={styles.panelTitle}>
                  My Treatments
                </h2>
                <p className={styles.panelSubtitle}>
                  Active medication requests and prescribed treatments.
                </p>
              </div>
            </div>

            {bookingIntents.length === 0 && appointments.length === 0 ? (
              <p className={styles.emptyState}>No treatments yet. Start a new treatment request when ready.</p>
            ) : (
              <ul className={styles.treatmentCards}>
                {bookingIntents.map((row) => {
                  const view = hubBookingIntentStatusView(row);
                  const selected = selectedBooking?.id === row.id;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={`${styles.treatmentCard} ${selected ? styles.treatmentCardSelected : ""}`}
                        onClick={() => {
                          setSelectedBookingId(row.id);
                          setDetailCheckout(null);
                        }}
                      >
                        <span className={styles.treatmentCardTop}>
                          <strong>{treatmentName(row)}</strong>
                          <span className={`${styles.statusPill} ${styles[`statusPill${view.tone}`]}`}>
                            {view.label}
                          </span>
                        </span>
                        <span>{view.subtitle}</span>
                        <small>{requestDate(row.created_at)}</small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={styles.panel}>
            {selectedBooking ? (
              <>
                <div className={styles.detailHeroCompact}>
                  <p className={styles.kicker}>Treatment details</p>
                  <h2>{treatmentName(selectedBooking)}</h2>
                  <p>{hubBookingIntentStatusView(selectedBooking).subtitle}</p>
                </div>
                <dl className={styles.detailFacts}>
                  <div>
                    <dt>Status</dt>
                    <dd>{hubBookingIntentStatusView(selectedBooking).label}</dd>
                  </div>
                  <div>
                    <dt>Payment</dt>
                    <dd>{selectedBooking.payment_status}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{requestDate(selectedBooking.created_at)}</dd>
                  </div>
                  {selectedBooking.ola_order_guid ? (
                    <div>
                      <dt>Provider order</dt>
                      <dd>{selectedBooking.ola_order_guid}</dd>
                    </div>
                  ) : null}
                </dl>
                {selectedBooking.payment_status !== "paid" ? (
                  <div className={styles.inlineActions}>
                    <button
                      type="button"
                      className={styles.scheduleNewBtn}
                      disabled={busy || selectedBookingCanceling}
                      onClick={() => openCheckoutForBooking(selectedBooking)}
                    >
                      Pay now
                    </button>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      disabled={busy || selectedBookingCanceling}
                      aria-busy={selectedBookingCanceling}
                      onClick={() => cancelUnpaidBooking(selectedBooking)}
                    >
                      {selectedBookingCanceling ? (
                        <span className={styles.buttonSpinner} aria-hidden="true" />
                      ) : null}
                      {selectedBookingCanceling ? "Canceling" : "Cancel"}
                    </button>
                  </div>
                ) : selectedBooking.ola_redirect_url ? (
                  <Link
                    href={`/ola-handoff/booking/${encodeURIComponent(selectedBooking.id)}`}
                    className={`${styles.scheduleNewBtn} ${styles.scheduleNewLink}`}
                  >
                    Continue next steps
                  </Link>
                ) : null}
                {detailCheckout ? (
                  <div className={styles.embeddedCheckoutFrame}>
                    <EmbeddedCheckoutProvider
                      stripe={stripePromise}
                      options={{
                        clientSecret: detailCheckout.clientSecret,
                        onComplete: () => onCheckoutComplete(detailCheckout),
                      }}
                    >
                      <EmbeddedCheckout />
                    </EmbeddedCheckoutProvider>
                  </div>
                ) : null}
              </>
            ) : (
              <p className={styles.emptyState}>Select a treatment to view details.</p>
            )}
          </div>
          </section>
        ) : null}

        {activeTab === "new" ? (
          <section className={styles.newTreatmentGrid} aria-labelledby="new-treatment-title">
          <div className={styles.panel}>
            <div className={styles.panelHeaderRow}>
              <div>
                <h2 id="new-treatment-title" className={styles.panelTitle}>
                  New Treatment
                </h2>
                <p className={styles.panelSubtitle}>
                  Choose a product, complete intake, confirm shipping, and check out.
                </p>
              </div>
            </div>
            <div className={styles.productGrid}>
              {products.map((product) => {
                const selected = product.product_key === selectedProduct?.product_key;
                return (
                  <button
                    key={product.product_key}
                    type="button"
                    className={`${styles.productCard} ${selected ? styles.productCardSelected : ""}`}
                    onClick={() => selectProduct(product)}
                  >
                    <strong>{product.name}</strong>
                    <span>{product.label}</span>
                    <small>
                      One-time ·{" "}
                      {currencyFromCents(
                        product.consultation_fee_cents + product.medication_fee_cents,
                        product.currency,
                      )}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedProduct ? (
            <div className={styles.panel}>
              <div className={styles.selectedProductBanner}>
                <div>
                  <p className={styles.kicker}>Selected product</p>
                  <h2>{selectedProduct.name}</h2>
                  <p>{selectedProduct.summary || selectedProduct.description}</p>
                </div>
                <strong>{currencyFromCents(productTotal, selectedProduct.currency)}</strong>
              </div>

              <div className={styles.flowSection}>
                <h3>Treatment questions</h3>
                <div className={styles.hubFormStack}>
                  {selectedQuestions.map((question) => (
                    <ProductQuestionField
                      key={question.id}
                      question={question}
                      answer={answers[question.question_key]}
                      onChange={(value) => {
                        setAnswers((current) => ({
                          ...current,
                          [question.question_key]: value,
                        }));
                        setNewCheckout(null);
                        setError(null);
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.flowSection}>
                <h3>Shipping address</h3>
                <div className={styles.hubAddressGrid}>
                  <label className={styles.hubField}>
                    Address
                    <input
                      className={styles.hubInput}
                      value={shipping.street_address}
                      onChange={(event) =>
                        setShipping((current) => ({
                          ...current,
                          street_address: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.hubField}>
                    Apt, suite, etc.
                    <input
                      className={styles.hubInput}
                      value={shipping.address_line2}
                      onChange={(event) =>
                        setShipping((current) => ({
                          ...current,
                          address_line2: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.hubField}>
                    City
                    <input
                      className={styles.hubInput}
                      value={shipping.city}
                      onChange={(event) =>
                        setShipping((current) => ({ ...current, city: event.target.value }))
                      }
                    />
                  </label>
                  <label className={styles.hubField}>
                    State
                    <select
                      className={styles.hubInput}
                      value={shipping.address_state}
                      onChange={(event) =>
                        setShipping((current) => ({
                          ...current,
                          address_state: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select</option>
                      {US_STATES.map((state) => (
                        <option key={state.code} value={state.code}>
                          {state.code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.hubField}>
                    ZIP
                    <input
                      className={styles.hubInput}
                      value={shipping.zip}
                      onChange={(event) =>
                        setShipping((current) => ({ ...current, zip: event.target.value }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div className={styles.flowSection}>
                <h3>Identity verification</h3>
                <div className={styles.idUploadGrid}>
                  {(["front", "back"] as const).map((side) => (
                    <label key={side} className={styles.idUploadBox}>
                      <span>{side === "front" ? "Front of ID" : "Back of ID"}</span>
                      <small>{idUploads[side]?.name ?? "JPG, PNG, or PDF up to 10 MB"}</small>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={(event) =>
                          setIdUploads((current) => ({
                            ...current,
                            [side]: event.target.files?.[0] ?? null,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.flowSection}>
                <h3>Review and checkout</h3>
                <dl className={styles.reviewList}>
                  <div>
                    <dt>Plan</dt>
                    <dd>{selectedProduct.name}</dd>
                  </div>
                  <div>
                    <dt>Shipping</dt>
                    <dd>{shippingSummary(shipping) || "Not complete"}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>{currencyFromCents(productTotal, selectedProduct.currency)}</dd>
                  </div>
                </dl>
                <p className={styles.refundNotice}>
                  Provider approval is required before medication ships. If the provider
                  determines you are not eligible, your payment will be refunded.
                </p>
                <button
                  type="button"
                  className={styles.scheduleNewBtn}
                  disabled={busy || !allQuestionsComplete || !shippingComplete(shipping) || Boolean(idError)}
                  onClick={createNewTreatmentCheckout}
                >
                  {busy ? "Preparing..." : "Continue to checkout"}
                </button>
              </div>

              {newCheckout ? (
                <div className={styles.embeddedCheckoutFrame}>
                  <EmbeddedCheckoutProvider
                    stripe={stripePromise}
                    options={{
                      clientSecret: newCheckout.clientSecret,
                      onComplete: () => onCheckoutComplete(newCheckout),
                    }}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              ) : null}
            </div>
          ) : null}
          </section>
        ) : null}

        {activeTab === "account" ? (
          <section className={styles.panel} aria-labelledby="account-tab-title">
          <div className={styles.detailHeroCompact}>
            <p className={styles.kicker}>Account</p>
            <h2 id="account-tab-title">Edit account information</h2>
            <p>
              Update your profile, contact information, and shipping details.
            </p>
          </div>
          <AccountProfileForm
            email={email}
            patientId={patientId}
            olaUserGuid={olaUserGuid}
            initialStep={initialStep}
            initialData={mergedIntake ?? {}}
          />
          </section>
        ) : null}
      </section>
    </main>
  );
}
