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
  reconcileCheckoutSession,
} from "@/lib/api/bookingIntents";
import { fetchVendorOlaOrderDetails } from "@/lib/api/vendorOla";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import type { IntakeQuestionAnswers } from "@/lib/intake/intakeQuestions";
import { intakeAnswerComplete } from "@/lib/intake/intakeQuestions";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { syncProfileDemographics } from "@/lib/intake/syncProfileDemographics";
import { buildTreatmentBookingIntentPayload } from "@/lib/scheduling/bookingIntentPayload";
import {
  checkoutReturnAction,
  checkoutReturnView,
  patientProviderIssueMessage,
  type BookingIntentReturnRow,
} from "@/lib/scheduling/checkoutReturn";
import { hubBookingIntentStatusView } from "@/lib/scheduling/hubBookingStatus";
import {
  olaOrderDetailRows,
  olaResponseMessage,
  type OlaOrderDetailRow,
} from "@/lib/scheduling/olaOrderDetails";
import { createClient } from "@/lib/supabase/client";
import type { TreatmentProduct } from "@/lib/treatmentProducts";
import { treatmentByKey, visibleTreatmentQuestions } from "@/lib/treatments";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductQuestionField } from "./ProductQuestionField";
import styles from "./hub.module.css";
import {
  EMPTY_ID_UPLOADS,
  EMPTY_SAVED_ID_DOCUMENTS,
  ID_BUCKET,
  idExtension,
  savedIdDocumentsComplete,
  shippingComplete,
  shippingFromIntake,
  shippingPatch,
  shippingSummary,
  validateIdFile,
  type IdSide,
  type IdUploads,
  type NewTreatmentStep,
  type SavedIdDocument,
  type SavedIdDocuments,
  type ShippingForm,
} from "./newTreatmentFlow";
import type { HubAppointmentRow, HubBookingIntentRow } from "./types";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type HubTab = "treatments" | "new" | "account";
type CheckoutState = {
  bookingIntentId: string;
  checkoutSessionId: string | null;
  clientSecret: string;
};
type CheckoutCompletionState = {
  bookingIntent: HubBookingIntentRow | null;
  error: string | null;
  syncing: boolean;
};
type OrderDetailState = {
  loading: boolean;
  error: string | null;
  payload: unknown | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function detailValueClass(row: OlaOrderDetailRow): string | undefined {
  const classes = [
    row.cap ? styles.detailCap : "",
    row.mono ? styles.detailMono : "",
  ].filter(Boolean);
  return classes.length > 0 ? classes.join(" ") : undefined;
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

function checkoutReturnRowFromHub(
  row: HubBookingIntentRow | null,
): BookingIntentReturnRow | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    booking_status: row.booking_status,
    payment_status: row.payment_status,
    ola_status: row.ola_status,
    ola_redirect_url: row.ola_redirect_url,
    failure_reason: row.failure_reason,
    intake_data: row.intake_data,
    selected_slot: row.selected_slot,
  };
}

async function loadBookingIntentByCheckoutSession(
  checkoutSessionId: string,
): Promise<HubBookingIntentRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("booking_intents")
    .select(
      "id, booking_status, payment_status, ola_status, selected_slot, intake_data, stripe_checkout_session_id, created_at, updated_at, ola_redirect_url, ola_popup_message, ola_order_guid, failure_reason",
    )
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as HubBookingIntentRow | null;
}

function patientInitials(name: string, email: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (parts[0]) {
    return parts[0][0].toUpperCase();
  }
  return email.slice(0, 1).toUpperCase();
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

function IdFilePreview({ file, label }: { file: File; label: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!previewUrl) {
    return (
      <div className={styles.idUploadPlaceholder} aria-hidden="true">
        PDF
      </div>
    );
  }

  return <img src={previewUrl} alt={`${label} preview`} />;
}

function IdUploadTile({
  file,
  inputId,
  onClear,
  onFileChange,
  savedDocument,
  side,
  useSavedDocument,
}: {
  file: File | null;
  inputId: string;
  onClear: () => void;
  onFileChange: (file: File | null) => void;
  savedDocument: SavedIdDocument | null;
  side: IdSide;
  useSavedDocument: boolean;
}) {
  const label = side === "front" ? "Front of ID" : "Back of ID";
  const hasSavedDocument = useSavedDocument && savedDocument != null;
  const hasSelection = file != null || hasSavedDocument;
  const detailText = file
    ? file.name
    : hasSavedDocument
      ? "Saved ID on file"
      : "JPG, PNG, or PDF up to 10 MB";

  return (
    <div className={`${styles.idUploadBox} ${hasSelection ? styles.idUploadBoxReady : ""}`}>
      <div className={styles.idUploadPreview}>
        {file ? (
          <IdFilePreview file={file} label={label} />
        ) : hasSavedDocument ? (
          <div className={styles.idUploadPlaceholder} aria-hidden="true">
            Saved
          </div>
        ) : (
          <div className={styles.idUploadPlaceholder} aria-hidden="true">
            Upload
          </div>
        )}
      </div>
      <div className={styles.idUploadInfo}>
        <span>{label}</span>
        <small>{detailText}</small>
      </div>
      <div className={styles.idUploadActions}>
        <label className={styles.idUploadAction} htmlFor={inputId}>
          {hasSelection ? "Retake" : "Upload"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(event) => {
            onFileChange(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
        {file ? (
          <button type="button" className={styles.idUploadAction} onClick={onClear}>
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CheckoutCompletionPanel({
  completion,
  onViewTreatments,
}: {
  completion: CheckoutCompletionState;
  onViewTreatments: () => void;
}) {
  const view = checkoutReturnView(checkoutReturnRowFromHub(completion.bookingIntent));
  const action = checkoutReturnAction(checkoutReturnRowFromHub(completion.bookingIntent));
  const title = completion.syncing ? "Finalizing request" : view.title;
  const lead = completion.syncing
    ? "Payment is confirmed. We are sending this request for provider review."
    : view.lead;

  return (
    <div className={styles.checkoutCompleteCard} role="status">
      <div className={`${styles.checkoutCompleteIcon} ${styles[`checkoutComplete${view.tone}`]}`}>
        {completion.syncing ? "..." : view.icon}
      </div>
      <div className={styles.checkoutCompleteCopy}>
        <p className={styles.kicker}>Checkout complete</p>
        <h3>{title}</h3>
        <p>{completion.error ?? lead}</p>
        {!completion.error && !completion.syncing ? (
          <p className={styles.checkoutCompleteHint}>{view.hint}</p>
        ) : null}
      </div>
      <div className={styles.checkoutCompleteActions}>
        <button type="button" className={styles.scheduleNewBtn} onClick={onViewTreatments}>
          View My Treatments
        </button>
        {action ? (
          <Link href={action.href} className={`${styles.secondaryButton} ${styles.inlineLinkButton}`}>
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function defaultPatientError(action: string): string {
  switch (action) {
    case "Checkout":
      return "Checkout could not be opened. Please try again.";
    case "Medication request":
      return "This treatment request could not be prepared. Please review your information and try again.";
    case "Cancel request":
      return "This request could not be canceled. Please try again.";
    case "Payment sync":
      return "Payment is confirmed, but we could not finish sending your request. Please check My Treatments for the latest status.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function rawErrorDetail(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("<")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    for (const key of ["reason", "message", "error"]) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  } catch {
    return trimmed.length < 220 ? trimmed : null;
  }
}

async function responseErrorMessage(action: string, res: Response): Promise<string> {
  const fallback = defaultPatientError(action);
  const raw = await res.text();
  const detail = rawErrorDetail(raw);
  if (!detail) {
    return fallback;
  }
  const patientDetail = patientProviderIssueMessage(detail);
  return patientDetail === fallback ? fallback : `${fallback} ${patientDetail}`;
}

export function PatientHubWorkspace({
  appointments,
  bookingIntents: initialBookingIntents,
  canViewAdminPortal = false,
  email,
  initialDraft,
  initialProfile,
  initialStep,
  olaUserGuid,
  patientId,
  products,
  savedIdDocuments = EMPTY_SAVED_ID_DOCUMENTS,
  serverLoadError,
  welcomeName,
}: {
  appointments: HubAppointmentRow[];
  bookingIntents: HubBookingIntentRow[];
  canViewAdminPortal?: boolean;
  email: string;
  initialDraft: IntakeDraftData | null;
  initialProfile: IntakeDraftData | null;
  initialStep: string;
  olaUserGuid: string | null;
  patientId: string;
  products: TreatmentProduct[];
  savedIdDocuments?: SavedIdDocuments;
  serverLoadError: string | null;
  welcomeName: string;
}) {
  const [activeTab, setActiveTab] = useState<HubTab>("treatments");
  const [bookingIntents, setBookingIntents] = useState(initialBookingIntents);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [orderDetailsByGuid, setOrderDetailsByGuid] = useState<Record<string, OrderDetailState>>({});
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);
  const [newTreatmentStep, setNewTreatmentStep] = useState<NewTreatmentStep>("select");
  const [answers, setAnswers] = useState<IntakeQuestionAnswers>({});
  const [questionStepIndex, setQuestionStepIndex] = useState(0);
  const mergedIntake = useMemo(
    () => mergeIntakeAndProfileDemographics(initialDraft, initialProfile),
    [initialDraft, initialProfile],
  );
  const [shipping, setShipping] = useState<ShippingForm>(() => shippingFromIntake(mergedIntake));
  const savedIdAvailable = savedIdDocumentsComplete(savedIdDocuments);
  const [useSavedIdDocuments, setUseSavedIdDocuments] = useState(savedIdAvailable);
  const [idUploads, setIdUploads] = useState<IdUploads>(EMPTY_ID_UPLOADS);
  const [detailCheckout, setDetailCheckout] = useState<CheckoutState | null>(null);
  const [newCheckout, setNewCheckout] = useState<CheckoutState | null>(null);
  const [checkoutCompletion, setCheckoutCompletion] =
    useState<CheckoutCompletionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelingBookingId, setCancelingBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(serverLoadError);

  const selectedBooking = bookingIntents.find((row) => row.id === selectedBookingId) ?? null;
  const selectedBookingCanceling =
    selectedBooking != null && cancelingBookingId === selectedBooking.id;
  const selectedOrderGuid = selectedBooking?.ola_order_guid ?? null;
  const selectedOrderState = selectedOrderGuid
    ? orderDetailsByGuid[selectedOrderGuid]
    : null;
  const selectedOrderRows = selectedOrderState?.payload
    ? olaOrderDetailRows(selectedOrderState.payload)
    : [];
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
  const questionStepCount = selectedQuestions.length;
  const currentQuestionIndex =
    questionStepCount > 0 ? Math.min(questionStepIndex, questionStepCount - 1) : 0;
  const currentQuestion = selectedQuestions[currentQuestionIndex] ?? null;
  const currentQuestionComplete = currentQuestion
    ? intakeAnswerComplete(currentQuestion, answers[currentQuestion.question_key])
    : true;
  const idFileError = validateIdFile(idUploads.front) ?? validateIdFile(idUploads.back);
  const idFrontReady =
    Boolean(idUploads.front) || (useSavedIdDocuments && Boolean(savedIdDocuments.front));
  const idBackReady =
    Boolean(idUploads.back) || (useSavedIdDocuments && Boolean(savedIdDocuments.back));
  const idDocumentsComplete = idFrontReady && idBackReady;
  const idError =
    idFileError ?? (idDocumentsComplete ? null : "Upload the front and back of your government ID.");
  const selectedProductComplete = selectedProduct != null;
  const newTreatmentStepNumber =
    newTreatmentStep === "questions" ? 2 : newTreatmentStep === "shipping" ? 3 : 4;
  const shippingStepComplete = shippingComplete(shipping) && !idError;
  const headerContent =
    activeTab === "new"
      ? {
          title: "New Treatment",
          description: "Choose a treatment, answer the required questions, and complete checkout.",
        }
      : activeTab === "account"
        ? {
            title: "Account",
            description: "Review and update the profile details used for treatment requests.",
          }
        : {
            title: "My Treatments",
            description: "View active requests, payment status, and provider review updates.",
          };

  function selectProduct(product: TreatmentProduct) {
    setSelectedProductKey(product.product_key);
    setAnswers({});
    setQuestionStepIndex(0);
    setNewCheckout(null);
    setError(null);
  }

  function resetNewTreatmentFlow() {
    setSelectedProductKey(null);
    setNewTreatmentStep("select");
    setAnswers({});
    setQuestionStepIndex(0);
    setShipping(shippingFromIntake(mergedIntake));
    setIdUploads(EMPTY_ID_UPLOADS);
    setUseSavedIdDocuments(savedIdAvailable);
    setNewCheckout(null);
  }

  function goToNewTreatmentStep(step: NewTreatmentStep) {
    setNewTreatmentStep(step);
    setError(null);
    setNewCheckout(null);
  }

  function goBackFromQuestionStep() {
    if (currentQuestionIndex > 0) {
      setQuestionStepIndex((current) => Math.max(0, current - 1));
      setError(null);
      setNewCheckout(null);
      return;
    }
    goToNewTreatmentStep("select");
  }

  function goForwardFromQuestionStep() {
    if (!currentQuestionComplete) {
      return;
    }
    if (currentQuestionIndex < questionStepCount - 1) {
      setQuestionStepIndex((current) => current + 1);
      setError(null);
      setNewCheckout(null);
      return;
    }
    goToNewTreatmentStep("shipping");
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

  useEffect(() => {
    setQuestionStepIndex((current) =>
      Math.min(Math.max(0, current), Math.max(0, selectedQuestions.length - 1)),
    );
  }, [selectedQuestions.length]);

  useEffect(() => {
    setAnswers((current) => {
      let next = current;
      for (const question of selectedQuestions) {
        if (question.question_type !== "number") {
          continue;
        }
        const answer = current[question.question_key];
        if (typeof answer === "string" && answer.trim()) {
          continue;
        }
        if (next === current) {
          next = { ...current };
        }
        next[question.question_key] = "0";
      }
      return next;
    });
  }, [selectedQuestions]);

  useEffect(() => {
    if (!selectedBooking) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedBookingId(null);
        setDetailCheckout(null);
        setCheckoutCompletion(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedBooking]);

  useEffect(() => {
    if (
      !selectedOrderGuid ||
      selectedOrderState?.loading ||
      selectedOrderState?.payload ||
      selectedOrderState?.error
    ) {
      return;
    }

    let cancelled = false;
    setOrderDetailsByGuid((current) => ({
      ...current,
      [selectedOrderGuid]: {
        loading: true,
        error: null,
        payload: null,
      },
    }));

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Sign in again to load provider details.");
        }

        const response = await fetchVendorOlaOrderDetails(
          session.access_token,
          selectedOrderGuid,
        );
        const payload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          throw new Error(
            olaResponseMessage(payload) ??
              `Provider details could not load (${response.status}).`,
          );
        }
        if (cancelled) {
          return;
        }
        setOrderDetailsByGuid((current) => ({
          ...current,
          [selectedOrderGuid]: {
            loading: false,
            error: null,
            payload,
          },
        }));
      } catch (err) {
        if (cancelled) {
          return;
        }
        setOrderDetailsByGuid((current) => ({
          ...current,
          [selectedOrderGuid]: {
            loading: false,
            error:
              err instanceof Error
                ? err.message
                : "Provider details could not load.",
            payload: null,
          },
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    selectedOrderGuid,
    selectedOrderState?.error,
    selectedOrderState?.loading,
    selectedOrderState?.payload,
  ]);

  async function saveGovernmentIdDocument({
    bookingIntentId,
    file,
    mimeType,
    side,
    userId,
  }: {
    bookingIntentId: string;
    file: Blob;
    mimeType: string;
    side: IdSide;
    userId: string;
  }) {
    const supabase = createClient();
    const storagePath = `${userId}/${bookingIntentId}/government-id-${side}.${idExtension(mimeType)}`;
    const { error: uploadError } = await supabase.storage
      .from(ID_BUCKET)
      .upload(storagePath, file, {
        contentType: mimeType,
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
          mime_type: mimeType,
          size_bytes: file.size,
        },
        { onConflict: "booking_intent_id,kind" },
      );
    if (documentError) {
      throw new Error(`Could not save ID upload: ${documentError.message}`);
    }
  }

  async function copySavedGovernmentIdDocument({
    bookingIntentId,
    document,
    side,
    userId,
  }: {
    bookingIntentId: string;
    document: SavedIdDocument;
    side: IdSide;
    userId: string;
  }) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(ID_BUCKET)
      .download(document.storage_path);
    if (error || !data) {
      throw new Error(`Could not reuse the saved ${side} of your ID.`);
    }
    await saveGovernmentIdDocument({
      bookingIntentId,
      file: data,
      mimeType: document.mime_type,
      side,
      userId,
    });
  }

  async function openCheckoutForBooking(row: HubBookingIntentRow) {
    setBusy(true);
    setError(null);
    setDetailCheckout(null);
    setCheckoutCompletion(null);
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
    setCheckoutCompletion(null);
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
      const bookingPayload = (await bookingResponse.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const bookingIntent =
        bookingPayload.bookingIntent && typeof bookingPayload.bookingIntent === "object"
          ? (bookingPayload.bookingIntent as Record<string, unknown>)
          : null;
      const bookingIntentId = typeof bookingIntent?.id === "string" ? bookingIntent.id : "";
      if (!bookingIntentId) {
        throw new Error("Could not prepare this medication request.");
      }

      await Promise.all(
        (["front", "back"] as const).map(async (side) => {
          const upload = idUploads[side];
          if (upload) {
            await saveGovernmentIdDocument({
              bookingIntentId,
              file: upload,
              mimeType: upload.type,
              side,
              userId: user.id,
            });
            return;
          }
          const savedDocument = savedIdDocuments[side];
          if (useSavedIdDocuments && savedDocument) {
            await copySavedGovernmentIdDocument({
              bookingIntentId,
              document: savedDocument,
              side,
              userId: user.id,
            });
            return;
          }
          throw new Error("Upload the front and back of your government ID.");
        }),
      );

      const checkoutResponse = await createBookingIntentCheckout(
        session.access_token,
        bookingIntentId,
        { embedded: true },
      );
      if (!checkoutResponse.ok) {
        throw new Error(await responseErrorMessage("Checkout", checkoutResponse));
      }
      const checkoutPayload = (await checkoutResponse.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
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
      setNewTreatmentStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  function selectTab(tab: HubTab) {
    setActiveTab(tab);
    if (tab === "new") {
      resetNewTreatmentFlow();
    }
    if (tab !== "treatments") {
      setSelectedBookingId(null);
      setDetailCheckout(null);
    }
    setCheckoutCompletion(null);
    setError(null);
  }

  async function onCheckoutComplete(checkout: CheckoutState | null, source: "new" | "detail") {
    if (!checkout?.checkoutSessionId) {
      setCheckoutCompletion({
        bookingIntent: null,
        error: "Payment completed, but we could not load the checkout session.",
        syncing: false,
      });
      return;
    }

    setCheckoutCompletion({ bookingIntent: null, error: null, syncing: true });
    setDetailCheckout(null);
    setNewCheckout(null);

    try {
      const { session } = await currentSession();
      const response = await reconcileCheckoutSession(
        session.access_token,
        checkout.checkoutSessionId,
      );
      if (!response.ok && response.status !== 409 && response.status !== 502) {
        throw new Error(await responseErrorMessage("Payment sync", response));
      }

      const latest = await loadBookingIntentByCheckoutSession(checkout.checkoutSessionId);
      if (latest) {
        setBookingIntents((current) => {
          const exists = current.some((row) => row.id === latest.id);
          return exists
            ? current.map((row) => (row.id === latest.id ? latest : row))
            : [latest, ...current];
        });
        if (source === "detail") {
          setSelectedBookingId(latest.id);
        }
      }

      setCheckoutCompletion({
        bookingIntent: latest,
        error: null,
        syncing: false,
      });
    } catch (err) {
      const latest = await loadBookingIntentByCheckoutSession(checkout.checkoutSessionId).catch(
        () => null,
      );
      if (latest) {
        setBookingIntents((current) =>
          current.some((row) => row.id === latest.id)
            ? current.map((row) => (row.id === latest.id ? latest : row))
            : [latest, ...current],
        );
      }
      setCheckoutCompletion({
        bookingIntent: latest,
        error:
          err instanceof Error
            ? err.message
            : "Payment is confirmed. We are syncing your medication request status.",
        syncing: false,
      });
    }
  }

  function showTreatmentsAfterCheckout() {
    setActiveTab("treatments");
    setNewTreatmentStep("select");
    setNewCheckout(null);
    setDetailCheckout(null);
    setCheckoutCompletion(null);
    setError(null);
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
          <div className={styles.sidebarUser}>
            <div className={styles.sidebarAvatar} aria-hidden="true">
              {patientInitials(welcomeName, email)}
            </div>
            <div className={styles.sidebarUserText}>
              <p>{welcomeName}</p>
              <span title={email}>{email}</span>
            </div>
          </div>
          {canViewAdminPortal ? (
            <Link href="/dashboard" className={styles.adminPortalLink}>
              View admin portal
            </Link>
          ) : null}
          <SignOutButton noMargin />
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.pageHeader}>
          <div>
            <h1>{headerContent.title}</h1>
            <p>{headerContent.description}</p>
          </div>
        </header>

        {error ? <p className={styles.error}>{error}</p> : null}

        {activeTab === "treatments" ? (
          <section className={styles.treatmentsPanel} aria-labelledby="my-treatments-title">
            <div className={styles.panel}>
              <div className={styles.panelHeaderRow}>
                <div>
                  <h2 id="my-treatments-title" className={styles.panelTitle}>
                    Current treatments
                  </h2>
                  <p className={styles.panelSubtitle}>
                    Select a treatment to review its details.
                  </p>
                </div>
              </div>

              {bookingIntents.length === 0 && appointments.length === 0 ? (
                <p className={styles.emptyState}>
                  No treatments yet. Start a new treatment request when ready.
                </p>
              ) : (
                <div className={styles.treatmentListStack}>
                  {bookingIntents.length > 0 ? (
                    <ul className={styles.treatmentCards}>
                      {bookingIntents.map((row) => {
                        const view = hubBookingIntentStatusView(row);
                        const selected = selectedBooking?.id === row.id;
                        return (
                          <li key={row.id}>
                            <button
                              type="button"
                              className={`${styles.treatmentCard} ${
                                selected ? styles.treatmentCardSelected : ""
                              }`}
                              onClick={() => {
                                setSelectedBookingId(row.id);
                                setDetailCheckout(null);
                                setError(null);
                              }}
                            >
                              <span className={styles.treatmentCardTop}>
                                <strong>{treatmentName(row)}</strong>
                                <span
                                  className={`${styles.statusPill} ${
                                    styles[`statusPill${view.tone}`]
                                  }`}
                                >
                                  {view.label}
                                </span>
                              </span>
                              <span>{view.subtitle}</span>
                              <small>Submitted {requestDate(row.created_at)}</small>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  {appointments.length > 0 ? (
                    <div className={styles.legacyAppointments}>
                      <p className={styles.kicker}>Legacy appointments</p>
                      <ul className={styles.treatmentCards}>
                        {appointments.map((appointment) => (
                          <li key={appointment.id}>
                            <div className={`${styles.treatmentCard} ${styles.treatmentCardStatic}`}>
                              <span className={styles.treatmentCardTop}>
                                <strong>
                                  {appointment.provider_name?.trim() || "Provider appointment"}
                                </strong>
                                <span className={styles.statusPill}>
                                  {appointment.status === "booked"
                                    ? "Confirmed"
                                    : appointment.status}
                                </span>
                              </span>
                              <span>
                                Provider appointment created before the simplified request flow.
                              </span>
                              <small>{requestDate(appointment.starts_at)}</small>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "new" ? (
          <section className={styles.newTreatmentGrid} aria-labelledby="new-treatment-title">
          {newTreatmentStep === "select" ? (
            <div className={styles.panel}>
              <div className={styles.panelHeaderRow}>
                <div>
                  <h2 id="new-treatment-title" className={styles.panelTitle}>
                    Choose a treatment
                  </h2>
                  <p className={styles.panelSubtitle}>
                    Select one active treatment to begin a new request.
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
              <div className={styles.flowActions}>
                <button
                  type="button"
                  className={styles.scheduleNewBtn}
                  disabled={!selectedProductComplete}
                  onClick={() => goToNewTreatmentStep("questions")}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {selectedProduct && newTreatmentStep !== "select" ? (
            <div className={styles.panel}>
              <div className={styles.selectedProductBanner}>
                <div>
                  <p className={styles.kicker}>Step {newTreatmentStepNumber} of 4</p>
                  <h2>{selectedProduct.name}</h2>
                  <p>{selectedProduct.summary || selectedProduct.description}</p>
                </div>
                <strong>{currencyFromCents(productTotal, selectedProduct.currency)}</strong>
              </div>

              {newTreatmentStep === "questions" ? (
              <div className={styles.flowSection}>
                <div className={styles.questionStepHeader}>
                  <div>
                    <p className={styles.questionStepMeta}>Treatment questions</p>
                    {questionStepCount === 0 ? <h3>No treatment questions required</h3> : null}
                  </div>
                  {questionStepCount > 0 ? (
                    <span className={styles.questionStepCount}>
                      Question {currentQuestionIndex + 1} of {questionStepCount}
                    </span>
                  ) : null}
                </div>
                <div className={styles.hubQuestionCard}>
                  {currentQuestion ? (
                    <ProductQuestionField
                      key={currentQuestion.id}
                      question={currentQuestion}
                      answer={answers[currentQuestion.question_key]}
                      onChange={(value) => {
                        setAnswers((current) => ({
                          ...current,
                          [currentQuestion.question_key]: value,
                        }));
                        setNewCheckout(null);
                        setError(null);
                      }}
                    />
                  ) : (
                    <p className={styles.emptyState}>
                      This treatment does not require additional questions before shipping.
                    </p>
                  )}
                </div>
                <div className={styles.flowActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={goBackFromQuestionStep}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={styles.scheduleNewBtn}
                    disabled={!currentQuestionComplete}
                    onClick={goForwardFromQuestionStep}
                  >
                    {currentQuestionIndex < questionStepCount - 1 ? "Next question" : "Next"}
                  </button>
                </div>
              </div>
              ) : null}

              {newTreatmentStep === "shipping" ? (
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

                <h3>Identity verification</h3>
                {savedIdAvailable ? (
                  <label className={styles.savedIdOption}>
                    <input
                      type="checkbox"
                      checked={useSavedIdDocuments}
                      onChange={(event) => {
                        setUseSavedIdDocuments(event.target.checked);
                        setNewCheckout(null);
                        setError(null);
                      }}
                    />
                    <span>Use the government ID already on file</span>
                  </label>
                ) : null}
                <div className={styles.idUploadGrid}>
                  {(["front", "back"] as const).map((side) => (
                    <IdUploadTile
                      key={side}
                      file={idUploads[side]}
                      inputId={`government-id-${side}`}
                      savedDocument={savedIdDocuments[side]}
                      side={side}
                      useSavedDocument={useSavedIdDocuments}
                      onFileChange={(file) => {
                        setIdUploads((current) => ({
                          ...current,
                          [side]: file,
                        }));
                        setNewCheckout(null);
                        setError(null);
                      }}
                      onClear={() => {
                        setIdUploads((current) => ({
                          ...current,
                          [side]: null,
                        }));
                        setNewCheckout(null);
                        setError(null);
                      }}
                    />
                  ))}
                </div>
                {idError ? <p className={styles.fieldError}>{idError}</p> : null}
                <div className={styles.flowActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => goToNewTreatmentStep("questions")}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={styles.scheduleNewBtn}
                    disabled={!shippingStepComplete}
                    onClick={() => goToNewTreatmentStep("checkout")}
                  >
                    Next
                  </button>
                </div>
              </div>
              ) : null}

              {newTreatmentStep === "checkout" ? (
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
                <div className={styles.flowActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={busy}
                    onClick={() => goToNewTreatmentStep("shipping")}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={styles.scheduleNewBtn}
                    disabled={busy || !allQuestionsComplete || !shippingStepComplete}
                    onClick={createNewTreatmentCheckout}
                  >
                    {busy ? "Preparing..." : "Continue to checkout"}
                  </button>
                </div>
              </div>
              ) : null}

              {newTreatmentStep === "payment" ? (
                <div className={styles.stripeCheckoutStep}>
                  {checkoutCompletion ? (
                    <CheckoutCompletionPanel
                      completion={checkoutCompletion}
                      onViewTreatments={showTreatmentsAfterCheckout}
                    />
                  ) : newCheckout ? (
                    <div className={styles.embeddedCheckoutFrame}>
                      <EmbeddedCheckoutProvider
                        stripe={stripePromise}
                        options={{
                          clientSecret: newCheckout.clientSecret,
                          onComplete: () => onCheckoutComplete(newCheckout, "new"),
                        }}
                      >
                        <EmbeddedCheckout />
                      </EmbeddedCheckoutProvider>
                    </div>
                  ) : (
                    <p className={styles.emptyState}>Preparing checkout...</p>
                  )}
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

        {selectedBooking ? (
          <div
            className={styles.drawerBackdrop}
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedBookingId(null);
                setDetailCheckout(null);
                setCheckoutCompletion(null);
              }
            }}
          >
            <aside
              className={styles.drawerPanel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="treatment-drawer-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header className={styles.drawerHeader}>
                <div>
                  <p className={styles.kicker}>Treatment details</p>
                  <h2 id="treatment-drawer-title">{treatmentName(selectedBooking)}</h2>
                  <p>{hubBookingIntentStatusView(selectedBooking).subtitle}</p>
                </div>
                <button
                  type="button"
                  className={styles.drawerClose}
                  aria-label="Close treatment details"
                  onClick={() => {
                    setSelectedBookingId(null);
                    setDetailCheckout(null);
                    setCheckoutCompletion(null);
                  }}
                >
                  x
                </button>
              </header>

              <div className={styles.drawerBody}>
                <section className={styles.drawerSection} aria-label="Treatment status">
                  <dl className={styles.detailFacts}>
                    <div>
                      <dt>Status</dt>
                      <dd>{hubBookingIntentStatusView(selectedBooking).label}</dd>
                    </div>
                    <div>
                      <dt>Payment</dt>
                      <dd className={styles.detailCap}>{selectedBooking.payment_status}</dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>{requestDate(selectedBooking.created_at)}</dd>
                    </div>
                    <div>
                      <dt>Last updated</dt>
                      <dd>{requestDate(selectedBooking.updated_at)}</dd>
                    </div>
                    {selectedBooking.ola_order_guid ? (
                      <div>
                        <dt>Provider order</dt>
                        <dd className={styles.detailMono}>{selectedBooking.ola_order_guid}</dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                {selectedBooking.ola_popup_message ? (
                  <section className={styles.drawerSection}>
                    <h3>Provider message</h3>
                    <p className={styles.detailMuted}>{selectedBooking.ola_popup_message}</p>
                  </section>
                ) : null}

                <section className={styles.drawerSection}>
                  <h3>Provider details</h3>
                  {!selectedOrderGuid ? (
                    <p className={styles.detailMuted}>
                      Provider details will appear after this request reaches the provider
                      network.
                    </p>
                  ) : null}
                  {selectedOrderState?.loading ? (
                    <p className={styles.detailMuted}>Loading provider details...</p>
                  ) : null}
                  {selectedOrderState?.error ? (
                    <p className={styles.detailError}>{selectedOrderState.error}</p>
                  ) : null}
                  {selectedOrderState?.payload && selectedOrderRows.length === 0 ? (
                    <p className={styles.detailMuted}>
                      No additional provider details are available yet.
                    </p>
                  ) : null}
                  {selectedOrderRows.length > 0 ? (
                    <dl className={`${styles.detailList} ${styles.detailListCompact}`}>
                      {selectedOrderRows.map((row) => (
                        <div key={`${row.label}-${row.value}`} className={styles.detailRow}>
                          <dt>{row.label}</dt>
                          <dd className={detailValueClass(row)}>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </section>

                <section className={styles.drawerSection}>
                  <h3>Actions</h3>
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
                  ) : (
                    <p className={styles.detailMuted}>
                      No patient action is needed right now.
                    </p>
                  )}

                  {detailCheckout ? (
                    <div className={styles.embeddedCheckoutFrame}>
                      <EmbeddedCheckoutProvider
                        stripe={stripePromise}
                        options={{
                          clientSecret: detailCheckout.clientSecret,
                          onComplete: () => onCheckoutComplete(detailCheckout, "detail"),
                        }}
                      >
                        <EmbeddedCheckout />
                      </EmbeddedCheckoutProvider>
                    </div>
                  ) : null}

                  {checkoutCompletion ? (
                    <CheckoutCompletionPanel
                      completion={checkoutCompletion}
                      onViewTreatments={showTreatmentsAfterCheckout}
                    />
                  ) : null}
                </section>
              </div>
            </aside>
          </div>
        ) : null}
      </section>
    </main>
  );
}
