"use client";

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { US_STATES } from "@/app/intake/usStates";
import type { AddressSuggestion } from "@/lib/addressSuggestions";
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
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./checkout.module.css";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;
const ID_BUCKET = "patient-documents";
const ID_MAX_BYTES = 10 * 1024 * 1024;
const ID_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const ID_IMAGE_UPLOAD_MAX_DIMENSION = 1800;
const ID_IMAGE_UPLOAD_QUALITY = 0.86;
const ID_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const TEMP_CONSULTATION_FEE = 99;
const TEMP_MEDICATION_FEE = 249;

type CheckoutState = {
  bookingIntentId: string;
  checkoutSessionId: string | null;
  clientSecret: string;
};

type CheckoutStep = "address" | "id" | "payment" | "mobilePayment";
type IdSide = "front" | "back";

type IdUploadState = {
  file: File | null;
  previewUrl: string | null;
  error: string | null;
};

type IdUploads = Record<IdSide, IdUploadState>;

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
  const maxBytes = file.type.startsWith("image/") ? ID_IMAGE_MAX_BYTES : ID_MAX_BYTES;
  if (file.size <= 0 || file.size > maxBytes) {
    return file.type.startsWith("image/")
      ? "Image must be 20 MB or less."
      : "PDF must be 10 MB or less.";
  }
  return null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read ID image."));
    };
    image.src = url;
  });
}

async function prepareIdUploadFile(file: File, side: IdSide): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    const image = await loadImage(file);
    const scale = Math.min(
      1,
      ID_IMAGE_UPLOAD_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", ID_IMAGE_UPLOAD_QUALITY);
    });
    if (!blob || blob.size <= 0 || blob.size > ID_MAX_BYTES) {
      return file;
    }
    return new File([blob], `government-id-${side}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function emptyIdUpload(): IdUploadState {
  return {
    file: null,
    previewUrl: null,
    error: null,
  };
}

function validateIdUploads(uploads: IdUploads): string | null {
  const frontError = validateIdFile(uploads.front.file);
  if (frontError) {
    return frontError === "Upload a government ID."
      ? "Upload the front of your government ID."
      : frontError;
  }
  const backError = validateIdFile(uploads.back.file);
  if (backError) {
    return backError === "Upload a government ID."
      ? "Upload the back of your government ID."
      : backError;
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

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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
  resumeBookingIntentId,
}: {
  initialDraft: IntakeDraftData | null;
  initialProfile: IntakeDraftData | null;
  resumeBookingIntentId?: string | null;
}) {
  const isResumePayment = Boolean(resumeBookingIntentId);
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
  const [step, setStep] = useState<CheckoutStep>(isResumePayment ? "payment" : "address");
  const [idUploads, setIdUploads] = useState<IdUploads>({
    front: emptyIdUpload(),
    back: emptyIdUpload(),
  });
  const idPreviewUrls = useRef(new Set<string>());
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSuggestionsLoading, setAddressSuggestionsLoading] = useState(false);
  const [addressSuggestionsOpen, setAddressSuggestionsOpen] = useState(false);
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
  const idUploadError = validateIdUploads(idUploads);
  const paymentReady = isResumePayment || (isShippingComplete && !idUploadError);

  function updateShipping(key: keyof ShippingForm, value: string) {
    setShipping((current) => ({ ...current, [key]: value }));
    if (key === "street_address") {
      setAddressSuggestionsOpen(Boolean(value.trim()));
    }
    setCheckout(null);
    setCheckoutShippingKey(null);
    setError(null);
  }

  function selectAddressSuggestion(suggestion: AddressSuggestion) {
    setShipping({
      street_address: suggestion.street,
      address_line2: "",
      city: suggestion.city,
      address_state: suggestion.state,
      zip: suggestion.postalCode,
    });
    setAddressSuggestions([]);
    setAddressSuggestionsOpen(false);
    setCheckout(null);
    setCheckoutShippingKey(null);
    setError(null);
  }

  function updateIdFile(side: IdSide, file: File | null) {
    const validationError = validateIdFile(file);
    setIdUploads((current) => {
      const currentSide = current[side];
      if (currentSide.previewUrl) {
        URL.revokeObjectURL(currentSide.previewUrl);
        idPreviewUrls.current.delete(currentSide.previewUrl);
      }
      const nextPreviewUrl =
        file && file.type.startsWith("image/") && !validationError
          ? URL.createObjectURL(file)
          : null;
      if (nextPreviewUrl) {
        idPreviewUrls.current.add(nextPreviewUrl);
      }
      return {
        ...current,
        [side]: {
          file,
          previewUrl: nextPreviewUrl,
          error: file ? validationError : null,
        },
      };
    });
    setCheckout(null);
    setCheckoutShippingKey(null);
    setError(null);
  }

  useEffect(() => {
    return () => {
      idPreviewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      idPreviewUrls.current.clear();
    };
  }, []);

  useEffect(() => {
    const query = shipping.street_address.trim();
    if (step !== "address" || query.length < 4) {
      setAddressSuggestions([]);
      setAddressSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    setAddressSuggestionsLoading(true);
    const timeout = window.setTimeout(() => {
      fetch(`/api/address-suggestions?query=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : { suggestions: [] }))
        .then((payload: unknown) => {
          const record =
            payload && typeof payload === "object"
              ? (payload as Record<string, unknown>)
              : {};
          setAddressSuggestions(
            Array.isArray(record.suggestions)
              ? (record.suggestions as AddressSuggestion[])
              : [],
          );
        })
        .catch((err: unknown) => {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            setAddressSuggestions([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setAddressSuggestionsLoading(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [shipping.street_address, step]);

  function continueFromAddress() {
    setError(null);
    if (!shippingComplete(shipping)) {
      setError("Enter your shipping address.");
      return;
    }
    setStep("id");
  }

  function continueFromId() {
    const validationError = validateIdUploads(idUploads);
    setError(null);
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep("payment");
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
    const uploadFile = await prepareIdUploadFile(file, side);
    if (uploadFile.size > ID_MAX_BYTES) {
      throw new Error(
        `Could not upload the ${side} of your ID. Please retake the photo a little farther back and try again.`,
      );
    }
    const storagePath = `${userId}/${bookingIntentId}/government-id-${side}.${idFileExtension(uploadFile)}`;
    const { error: uploadError } = await supabase.storage
      .from(ID_BUCKET)
      .upload(storagePath, uploadFile, {
        contentType: uploadFile.type,
        upsert: true,
      });
    if (uploadError) {
      throw new Error(
        `Could not upload the ${side} of your ID. Please try again or retake the photo.`,
      );
    }

    const { error: documentError } = await supabase
      .from("booking_intent_documents")
      .upsert(
        {
          booking_intent_id: bookingIntentId,
          user_id: userId,
          kind: `government_id_${side}`,
          storage_path: storagePath,
          mime_type: uploadFile.type,
          size_bytes: uploadFile.size,
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
      if (!isResumePayment && !shippingComplete(shipping)) {
        throw new Error("Enter your shipping address.");
      }
      const validationError = isResumePayment ? null : validateIdUploads(idUploads);
      if (!isResumePayment && validationError) {
        throw new Error(validationError);
      }
      const frontFile = idUploads.front.file;
      const backFile = idUploads.back.file;
      if (!isResumePayment && (!frontFile || !backFile)) {
        throw new Error("Upload the front and back of your government ID.");
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

      const intakeForCheckout: IntakeDraftData = isResumePayment ? intake : {
        ...intake,
        ...shippingPatch(shipping),
      };
      setIntake(intakeForCheckout);

      let bookingIntentId = resumeBookingIntentId ?? "";
      if (!isResumePayment) {
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
        bookingIntentId =
          typeof bookingIntent?.id === "string" ? bookingIntent.id : "";
      }
      if (!bookingIntentId) {
        throw new Error("Could not prepare this medication request for payment.");
      }

      if (!isResumePayment && frontFile && backFile) {
        await saveGovernmentIdDocument({
          bookingIntentId,
          file: frontFile,
          side: "front",
          userId: user.id,
        });
        await saveGovernmentIdDocument({
          bookingIntentId,
          file: backFile,
          side: "back",
          userId: user.id,
        });
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
      setCheckoutShippingKey(shippingKey(shipping));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setLoadingCheckout(false);
    }
  }

  useEffect(() => {
    if (
      (step !== "payment" && step !== "mobilePayment") ||
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
              <div className={styles.sectionIntro}>
                <h2 id="shipping-title" className={styles.sectionTitle}>Shipping address</h2>
                <p className={styles.sectionSubtitle}>
                  This is where your medication will be shipped after provider approval.
                </p>
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
              <div className={styles.formStack}>
                <div className={styles.field}>
                  <label htmlFor="shipping-address">Address</label>
                  <input
                    id="shipping-address"
                    className={styles.input}
                    value={shipping.street_address}
                    onChange={(event) => updateShipping("street_address", event.target.value)}
                    onFocus={() => setAddressSuggestionsOpen(true)}
                    autoComplete="shipping street-address"
                  />
                  {addressSuggestionsOpen &&
                  (addressSuggestions.length > 0 || addressSuggestionsLoading) ? (
                    <div className={styles.addressSuggestions}>
                      {addressSuggestionsLoading ? (
                        <div className={styles.addressSuggestionMuted}>
                          Finding addresses...
                        </div>
                      ) : null}
                      {addressSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          className={styles.addressSuggestion}
                          onClick={() => selectAddressSuggestion(suggestion)}
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
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
              </div>
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
              <div className={styles.sectionIntro}>
                <h2 id="id-title" className={styles.sectionTitle}>Verify identity</h2>
                <p className={styles.sectionSubtitle}>
                  Upload a photo of your government ID so your provider can confirm your identity
                  before review. Your ID is stored securely and shared only with the care team for
                  verification.
                </p>
              </div>
              <div className={styles.uploadGrid}>
                {(["front", "back"] as const).map((side) => {
                  const upload = idUploads[side];
                  return (
                    <div key={side} className={styles.uploadPanel}>
                      <label className={styles.uploadBox}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,application/pdf"
                          capture="environment"
                          onChange={(event) => updateIdFile(side, event.target.files?.[0] ?? null)}
                        />
                        {upload.previewUrl ? (
                          <img
                            src={upload.previewUrl}
                            alt={`Selected government ID ${side} preview`}
                            className={styles.uploadPreview}
                          />
                        ) : null}
                        <span className={styles.uploadTitle}>
                          {upload.file
                            ? upload.file.name
                            : `${side === "front" ? "Front" : "Back"} of ID`}
                        </span>
                        <span className={styles.uploadMeta}>
                          {upload.file ? fileSizeLabel(upload.file.size) : "JPG, PNG, or PDF up to 10 MB"}
                        </span>
                      </label>
                      {upload.error ? <p className={styles.inlineError}>{upload.error}</p> : null}
                      {upload.file ? (
                        <div className={styles.uploadActions}>
                          <label className={styles.retakeButton}>
                            Retake
                            <input
                              type="file"
                              accept="image/jpeg,image/png,application/pdf"
                              capture="environment"
                              onChange={(event) => updateIdFile(side, event.target.files?.[0] ?? null)}
                            />
                          </label>
                          <button
                            type="button"
                            className={styles.removeButton}
                            onClick={() => updateIdFile(side, null)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setStep("address")}>
                  Back
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={Boolean(idUploadError)}
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
                <>
                  <div className={styles.summaryLine}>
                    <span>{treatment.name}</span>
                  </div>
                  <dl className={styles.purchaseList} aria-label="Purchase breakdown">
                    <div>
                      <dt>Consultation fee</dt>
                      <dd>Provider review and treatment eligibility</dd>
                      <strong>{currency(TEMP_CONSULTATION_FEE)}</strong>
                    </div>
                    <div>
                      <dt>Medication fee</dt>
                      <dd>Medication cost placeholder</dd>
                      <strong>{currency(TEMP_MEDICATION_FEE)}</strong>
                    </div>
                    <div className={styles.totalRow}>
                      <dt>Total</dt>
                      <dd>Due today</dd>
                      <strong>{currency(TEMP_CONSULTATION_FEE + TEMP_MEDICATION_FEE)}</strong>
                    </div>
                  </dl>
                </>
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
                  <dd>
                    {isResumePayment
                      ? "Already submitted"
                      : idUploads.front.file && idUploads.back.file
                        ? `${idUploads.front.file.name}, ${idUploads.back.file.name}`
                        : "Missing front or back"}
                  </dd>
                </div>
              </dl>
              {isResumePayment ? (
                <Link href="/hub" className={styles.textLink}>
                  Back to request
                </Link>
              ) : (
                <button type="button" className={styles.textButton} onClick={() => setStep("id")}>
                  Edit details
                </button>
              )}
              <div className={styles.mobilePaymentAction}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={!paymentReady}
                  onClick={() => setStep("mobilePayment")}
                >
                  Continue to payment
                </button>
              </div>
            </section>
          ) : null}

          {step === "payment" || step === "mobilePayment" ? (
            <section
              className={`${styles.paymentColumn} ${
                step === "payment" ? styles.desktopPaymentColumn : ""
              }`}
              aria-label="Payment form"
            >
              {step === "mobilePayment" ? (
                <button
                  type="button"
                  className={styles.mobileBackButton}
                  onClick={() => setStep("payment")}
                >
                  Back to details
                </button>
              ) : null}
              {error ? <p className={styles.error}>{error}</p> : null}
              {loadingCheckout || !checkout ? (
                <div className={styles.paymentSkeleton} role="status">
                  <span className={styles.paymentLoader} aria-hidden="true" />
                  <span>Preparing secure payment...</span>
                  <small>This can take a few seconds.</small>
                </div>
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
