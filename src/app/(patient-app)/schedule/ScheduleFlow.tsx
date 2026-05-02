"use client";

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  fetchVendorOlaPharmacies,
  fetchVendorOlaSchedules,
} from "@/lib/api/vendorOla";
import {
  createBookingIntent,
  createBookingIntentCheckout,
} from "@/lib/api/bookingIntents";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { APPOINTMENT_QUESTIONS } from "@/lib/scheduling/appointmentQuestions";
import { buildBookingIntentPayload } from "@/lib/scheduling/bookingIntentPayload";
import {
  availableDatesFromOlaScheduleResponse,
  slotsFromOlaScheduleResponse,
  type SlotDisplay,
} from "@/lib/scheduling/olaProviderSchedules";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./schedule.module.css";

type Step = "intake" | "pharmacy" | "calendar";

type EmbeddedCheckoutState = {
  bookingIntentId: string;
  checkoutSessionId: string | null;
  clientSecret: string;
};

type InsuranceForm = {
  insurance_member_id: string;
  insurance_plan_name: string;
  payer_identification: string;
  cover_type: string;
};

const EMPTY_INSURANCE: InsuranceForm = {
  insurance_member_id: "",
  insurance_plan_name: "",
  payer_identification: "",
  cover_type: "Primary",
};

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type PharmacyChoice = {
  key: string;
  name: string;
  address: string;
  phone: string;
  fax: string;
  ncpdpId: string;
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildCalendarCells(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: {
    day: number | null;
    iso: string | null;
    inMonth: boolean;
    disabled: boolean;
  }[] = [];

  for (let i = 0; i < startPad; i++) {
    cells.push({ day: null, iso: null, inMonth: false, disabled: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const iso = toIsoDate(dt);
    const disabled = dt < today;
    cells.push({ day: d, iso, inMonth: true, disabled });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, iso: null, inMonth: false, disabled: true });
  }
  return { year, month, cells };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function availabilityErrorMessage(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  if (!raw.trim()) {
    return `Availability request failed (${res.status}).`;
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
      return `Availability request failed (${res.status}): ${message}`;
    }
  } catch {
    /* use raw response text */
  }

  return `Availability request failed (${res.status}): ${raw}`;
}

async function vendorResponseErrorMessage(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  if (!raw.trim()) {
    return `Appointment request failed (${res.status}).`;
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
      return `Appointment request failed (${res.status}): ${message}`;
    }
  } catch {
    /* use raw response text */
  }
  return `Appointment request failed (${res.status}): ${raw}`;
}

function stringFromRecord(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function stringValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function pharmacyChoicesFromResponse(json: unknown): PharmacyChoice[] {
  if (!json || typeof json !== "object") {
    return [];
  }
  const result = (json as Record<string, unknown>).result;
  if (!Array.isArray(result)) {
    return [];
  }

  return result.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const record = item as Record<string, unknown>;
    const name = stringValue(record, ["StoreName", "pharmacy_name", "name"]);
    if (!name) {
      return [];
    }
    const cityStateZip = [
      stringValue(record, ["City"]),
      stringValue(record, ["State"]),
      stringValue(record, ["ZipCode"]),
    ]
      .filter(Boolean)
      .join(", ");
    const address = [
      stringValue(record, ["Address1"]),
      stringValue(record, ["Address2"]),
      cityStateZip,
    ]
      .filter(Boolean)
      .join(" ");
    const ncpdpId = stringValue(record, ["NCPDPID", "pharmacy_ncpdp_id"]);

    return [
      {
        key: ncpdpId || `${name}-${index}`,
        name,
        address,
        phone: stringValue(record, ["PrimaryPhone", "pharmacy_phone"]),
        fax: stringValue(record, ["PrimaryFax", "pharmacy_fax"]),
        ncpdpId,
      },
    ];
  });
}

async function pharmacyErrorMessage(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  if (!raw.trim()) {
    return `Pharmacy search failed (${res.status}).`;
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
      return `Pharmacy search failed (${res.status}): ${message}`;
    }
  } catch {
    /* use raw response text */
  }
  return `Pharmacy search failed (${res.status}): ${raw}`;
}

export function ScheduleFlow({
  patient,
  serviceState,
}: {
  patient: IntakeDraftData;
  serviceState: string | null;
}) {
  const [step, setStep] = useState<Step>("intake");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyZip, setPharmacyZip] = useState(() => patient.zip?.trim() ?? "");
  const [pharmacyLoading, setPharmacyLoading] = useState(false);
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);
  const [pharmacyResults, setPharmacyResults] = useState<PharmacyChoice[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyChoice | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [scheduleResponse, setScheduleResponse] = useState<unknown | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDisplay[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [insurance, setInsurance] = useState<InsuranceForm>(EMPTY_INSURANCE);
  const [insuranceModalOpen, setInsuranceModalOpen] = useState(false);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [embeddedCheckout, setEmbeddedCheckout] = useState<EmbeddedCheckoutState | null>(null);

  const serviceStateValue = (serviceState ?? "").trim();
  const scheduleBlockedReason = !serviceStateValue
    ? "Complete intake with a service state before scheduling."
    : null;

  const { year, month, cells } = useMemo(
    () => buildCalendarCells(monthCursor),
    [monthCursor],
  );

  const monthLabel = useMemo(
    () => new Date(year, month).toLocaleString(undefined, { month: "long", year: "numeric" }),
    [year, month],
  );

  const canPrevMonth = useMemo(() => {
    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const cur = new Date(year, month, 1);
    return cur > startThisMonth;
  }, [year, month]);

  const availableDates = useMemo(
    () => availableDatesFromOlaScheduleResponse(scheduleResponse),
    [scheduleResponse],
  );

  const intakeValid = useMemo(() => {
    for (const q of APPOINTMENT_QUESTIONS) {
      if (q.required && !(answers[q.id] ?? "").trim()) {
        return false;
      }
    }
    return true;
  }, [answers]);

  const onIntakeSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!intakeValid || scheduleBlockedReason) {
        return;
      }
      setStep("pharmacy");
    },
    [intakeValid, scheduleBlockedReason],
  );

  const onSearchPharmacies = useCallback(async () => {
    const name = pharmacyName.trim();
    const zip = pharmacyZip.trim();
    if (name.length < 3 || !zip) {
      setPharmacyError("Enter a pharmacy name and ZIP code.");
      return;
    }

    setPharmacyLoading(true);
    setPharmacyError(null);
    setPharmacyResults([]);
    setSelectedPharmacy(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sign in again to search pharmacies.");
      }

      const response = await fetchVendorOlaPharmacies(session.access_token, {
        pharmacyName: name,
        zipCode: zip,
      });

      if (!response.ok) {
        throw new Error(await pharmacyErrorMessage(response));
      }

      const json = (await response.json().catch(() => null)) as unknown;
      const rows = pharmacyChoicesFromResponse(json);
      setPharmacyResults(rows);
      if (rows.length === 0) {
        setPharmacyError("No pharmacies found for that search.");
      }
    } catch (err) {
      setPharmacyError(
        err instanceof Error ? err.message : "Could not search pharmacies.",
      );
    } finally {
      setPharmacyLoading(false);
    }
  }, [pharmacyName, pharmacyZip]);

  useEffect(() => {
    if (step !== "calendar") {
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingAvailability(true);
      setAvailabilityError(null);
      setScheduleResponse(null);
      setSlots([]);
      setSelectedSlotId(null);
      setSlotsError(null);

      try {
        if (scheduleBlockedReason) {
          throw new Error(scheduleBlockedReason);
        }

        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Sign in again to load availability.");
        }

        const res = await fetchVendorOlaSchedules(
          session.access_token,
          serviceStateValue,
        );
        if (!res.ok) {
          throw new Error(await availabilityErrorMessage(res));
        }

        const json: unknown = await res.json();
        if (!cancelled) {
          setScheduleResponse(json);
        }
      } catch (err) {
        if (!cancelled) {
          setAvailabilityError(
            err instanceof Error
              ? err.message
              : "Could not load availability from our service provider.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAvailability(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleBlockedReason, serviceStateValue, step]);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setSelectedSlotId(null);
      setSlotsError(null);
      return;
    }
    if (availabilityError) {
      setSlots([]);
      setSelectedSlotId(null);
      setSlotsError(availabilityError);
      return;
    }
    if (loadingAvailability || !scheduleResponse) {
      setSlots([]);
      setSelectedSlotId(null);
      setSlotsError(null);
      return;
    }
    setSlots(slotsFromOlaScheduleResponse(scheduleResponse, selectedDate));
    setSelectedSlotId(null);
    setSlotsError(null);
  }, [availabilityError, loadingAvailability, scheduleResponse, selectedDate]);

  const canConfirm =
    Boolean(selectedDate && selectedSlotId && !loadingAvailability);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) ?? null,
    [selectedSlotId, slots],
  );

  const selectedSlotSummary = useMemo(() => {
    if (!selectedDate || !selectedSlot) {
      return null;
    }
    const day = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    return `${day} at ${selectedSlot.label}`;
  }, [selectedDate, selectedSlot]);

  const insuranceComplete = Boolean(
    insurance.insurance_member_id.trim() &&
      insurance.insurance_plan_name.trim() &&
      insurance.payer_identification.trim() &&
      insurance.cover_type.trim(),
  );

  const onConfirmAppointment = useCallback(async () => {
    if (!selectedDate || !selectedSlot || !selectedPharmacy || confirmSaving) {
      return;
    }
    setConfirmError(null);
    setConfirmSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setConfirmError("Sign in again to continue to payment.");
        return;
      }

      if (!selectedSlot.providerGuid?.trim()) {
        setConfirmError("That time slot is missing provider details. Pick another time.");
        return;
      }

      const bookingRes = await createBookingIntent(
        session.access_token,
        buildBookingIntentPayload({
          answers,
          insurance,
          patient,
          pharmacy: selectedPharmacy,
          selectedSlot,
          serviceState: serviceStateValue,
        }),
      );
      if (!bookingRes.ok) {
        setConfirmError(await vendorResponseErrorMessage(bookingRes));
        return;
      }
      const bookingJson = (await bookingRes.json().catch(() => ({}))) as Record<string, unknown>;
      const bookingIntent =
        bookingJson.bookingIntent && typeof bookingJson.bookingIntent === "object"
          ? (bookingJson.bookingIntent as Record<string, unknown>)
          : null;
      const bookingIntentId =
        typeof bookingIntent?.id === "string" ? bookingIntent.id : "";
      if (!bookingIntentId) {
        setConfirmError("Could not prepare this appointment for payment.");
        return;
      }

      const checkoutRes = await createBookingIntentCheckout(
        session.access_token,
        bookingIntentId,
        { embedded: true },
      );
      if (!checkoutRes.ok) {
        setConfirmError(await vendorResponseErrorMessage(checkoutRes));
        return;
      }
      const checkoutJson = (await checkoutRes.json().catch(() => ({}))) as Record<string, unknown>;
      const checkoutClientSecret = stringFromRecord(checkoutJson, [
        "clientSecret",
        "checkoutClientSecret",
        "client_secret",
      ]);
      if (checkoutClientSecret) {
        if (!stripePublishableKey) {
          setConfirmError("Stripe publishable key is not configured.");
          return;
        }
        setEmbeddedCheckout({
          bookingIntentId,
          checkoutSessionId: stringFromRecord(checkoutJson, [
            "checkoutSessionId",
            "checkout_session_id",
            "sessionId",
          ]) || null,
          clientSecret: checkoutClientSecret,
        });
        setInsuranceModalOpen(false);
        return;
      }

      setConfirmError("Embedded checkout is not available yet. Please try again in a moment.");
    } finally {
      setConfirmSaving(false);
    }
  }, [answers, insurance, patient, selectedDate, selectedPharmacy, selectedSlot, confirmSaving, serviceStateValue]);

  const onEmbeddedCheckoutComplete = useCallback(() => {
    const checkoutSessionId = embeddedCheckout?.checkoutSessionId;
    if (checkoutSessionId) {
      window.location.assign(
        `/schedule/confirmed?checkout_session_id=${encodeURIComponent(checkoutSessionId)}`,
      );
      return;
    }
    window.location.assign("/hub");
  }, [embeddedCheckout?.checkoutSessionId]);

  if (embeddedCheckout) {
    return (
      <>
        <h1 className={styles.title}>Complete payment</h1>
        <p className={styles.stepHint}>
          Your appointment request is ready. Complete payment here to continue booking.
        </p>
        <section className={styles.paymentCard} aria-labelledby="payment-title">
          <div className={styles.paymentHeader}>
            <div>
              <h2 id="payment-title" className={styles.paymentTitle}>
                Payment
              </h2>
              <p className={styles.paymentMeta}>
                Booking {embeddedCheckout.bookingIntentId.slice(0, 8)}
              </p>
            </div>
          </div>
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{
              clientSecret: embeddedCheckout.clientSecret,
              onComplete: onEmbeddedCheckoutComplete,
            }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
          <div className={styles.paymentActions}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => {
                setEmbeddedCheckout(null);
                setConfirmError(null);
              }}
            >
              ← Back to appointment
            </button>
          </div>
        </section>
      </>
    );
  }

  if (step === "intake") {
    return (
      <>
        <h1 className={styles.title}>Schedule appointment</h1>
        <p className={styles.stepHint}>
          Step 1 of 3 — a few questions for this visit.
        </p>
        {scheduleBlockedReason ? (
          <p className={styles.stateNote} role="alert">
            {scheduleBlockedReason}
          </p>
        ) : (
          <p className={styles.stateNote}>
            Using service state <strong>{serviceStateValue}</strong> from your profile for availability.
          </p>
        )}
        <form className={styles.form} onSubmit={onIntakeSubmit}>
          {APPOINTMENT_QUESTIONS.map((q) => (
            <div key={q.id} className={styles.field}>
              <label className={styles.label} htmlFor={q.id}>
                {q.label}
                {q.required ? " *" : ""}
              </label>
              {q.type === "select" ? (
                <select
                  id={q.id}
                  className={styles.select}
                  required={q.required}
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                >
                  <option value="">Select…</option>
                  {q.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  id={q.id}
                  className={styles.textarea}
                  required={q.required}
                  placeholder={q.placeholder}
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              )}
            </div>
          ))}
          <div className={styles.actions}>
            <Link href="/hub" className={styles.btnGhost}>
              ← Back to Patient Hub
            </Link>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={!intakeValid || Boolean(scheduleBlockedReason)}
            >
              Continue to pharmacy
            </button>
          </div>
        </form>
      </>
    );
  }

  if (step === "pharmacy") {
    return (
      <>
        <h1 className={styles.title}>Choose pharmacy</h1>
        <p className={styles.stepHint}>
          Step 2 of 3 — select the pharmacy for this visit.
        </p>
        <div className={styles.pharmacyCard}>
          <form
            className={styles.pharmacySearchGrid}
            onSubmit={(e) => {
              e.preventDefault();
              void onSearchPharmacies();
            }}
          >
            <label className={styles.field}>
              <span className={styles.label}>Pharmacy name</span>
              <input
                className={styles.input}
                value={pharmacyName}
                onChange={(e) => {
                  setPharmacyName(e.target.value);
                  setSelectedPharmacy(null);
                }}
                placeholder="CVS, Walgreens, Walmart"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>ZIP code</span>
              <input
                className={styles.input}
                value={pharmacyZip}
                onChange={(e) => {
                  setPharmacyZip(e.target.value);
                  setSelectedPharmacy(null);
                }}
                inputMode="numeric"
                placeholder="ZIP"
              />
            </label>
            <button
              type="submit"
              className={styles.pharmacySearchButton}
              disabled={pharmacyLoading}
            >
              {pharmacyLoading ? "Searching..." : "Search"}
            </button>
          </form>

          {selectedPharmacy ? (
            <div className={styles.selectedPharmacy}>
              <span className={styles.selectedPharmacyLabel}>Selected</span>
              <strong>{selectedPharmacy.name}</strong>
              <span>{selectedPharmacy.address}</span>
            </div>
          ) : null}

          {pharmacyError ? (
            <p className={styles.confirmError} role="alert">
              {pharmacyError}
            </p>
          ) : null}

          <div className={styles.pharmacyResultsPanel}>
            {pharmacyResults.length > 0 ? (
              <ul className={styles.pharmacyList}>
                {pharmacyResults.map((pharmacy) => {
                  const selected = selectedPharmacy?.key === pharmacy.key;
                  return (
                    <li key={pharmacy.key}>
                      <button
                        type="button"
                        className={`${styles.pharmacyOption} ${selected ? styles.pharmacyOptionSelected : ""}`}
                        onClick={() => setSelectedPharmacy(pharmacy)}
                        aria-pressed={selected}
                      >
                        <span className={styles.pharmacyOptionName}>
                          {pharmacy.name}
                        </span>
                        <span className={styles.pharmacyOptionAddress}>
                          {pharmacy.address}
                        </span>
                        <span className={styles.pharmacyOptionMeta}>
                          {[
                            pharmacy.phone ? `Phone ${pharmacy.phone}` : null,
                            pharmacy.fax ? `Fax ${pharmacy.fax}` : null,
                            pharmacy.ncpdpId ? `NCPDP ${pharmacy.ncpdpId}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.pharmacyResultsEmpty}>
                Search by pharmacy name and ZIP code to choose a location.
              </p>
            )}
          </div>
        </div>

        <div className={styles.confirmBar}>
          <button
            type="button"
            className={styles.btnGhost}
            disabled={pharmacyLoading}
            onClick={() => {
              setStep("intake");
              setPharmacyError(null);
            }}
          >
            ← Back to questions
          </button>
          <button
            type="button"
            className={styles.btnConfirm}
            disabled={!selectedPharmacy || pharmacyLoading}
            onClick={() => {
              setPharmacyError(null);
              setStep("calendar");
            }}
          >
            Continue to calendar
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>Choose date &amp; time</h1>
      <p className={styles.stepHint}>
        Step 3 of 3 — pick a day, then a time.
      </p>
      <div className={styles.calendarCard}>
        <div className={styles.calendarLayout}>
          <div className={styles.calendarPane}>
            <div className={styles.monthNav}>
              <button
                type="button"
                className={styles.navBtn}
                disabled={!canPrevMonth}
                onClick={() =>
                  setMonthCursor(new Date(year, month - 1, 1))
                }
                aria-label="Previous month"
              >
                ←
              </button>
              <p className={styles.monthLabel}>{monthLabel}</p>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
                aria-label="Next month"
              >
                →
              </button>
            </div>
            <div className={styles.weekdays}>
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className={styles.grid}>
              {cells.map((cell, i) => {
                if (!cell.inMonth || cell.day == null || !cell.iso) {
                  return (
                    <div key={`pad-${i}`} className={styles.dayCellEmpty} aria-hidden />
                  );
                }
                const selected = selectedDate === cell.iso;
                const hasAvailability = availableDates.has(cell.iso);
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    className={`${styles.dayCell} ${hasAvailability ? styles.dayCellAvailable : ""} ${cell.disabled ? styles.dayCellDisabled : ""} ${selected ? styles.dayCellSelected : ""}`}
                    disabled={cell.disabled}
                    onClick={() => setSelectedDate(cell.iso)}
                    title={hasAvailability ? "Available times" : undefined}
                  >
                    {cell.day}
                    {hasAvailability ? (
                      <span className={styles.availabilityDot} aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.slotsSection}>
            <p className={styles.slotsTitle}>
              {!selectedDate
                ? "Select an available day"
                : loadingAvailability
                ? "Loading times…"
                : `Times for ${new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}`}
            </p>
            {!selectedDate ? (
              <p className={styles.stepHint}>
                Green days have available appointment times.
              </p>
            ) : null}
            {selectedDate && !loadingAvailability && slots.length === 0 ? (
              <p className={styles.stepHint}>
                {slotsError ?? "No open slots that day. Try another date."}
              </p>
            ) : null}
            {selectedDate && !loadingAvailability && slots.length > 0 ? (
              <ul className={styles.slotList}>
                {slots.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`${styles.slotBtn} ${selectedSlotId === s.id ? styles.slotBtnSelected : ""}`}
                      onClick={() => setSelectedSlotId(s.id)}
                      aria-pressed={selectedSlotId === s.id}
                    >
                      {s.label}
                      {s.provider ? ` · ${s.provider}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
      {confirmError ? (
        <p className={styles.confirmError} role="alert">
          {confirmError}
        </p>
      ) : null}
      <div className={styles.confirmBar}>
        <button
          type="button"
          className={styles.btnGhost}
          disabled={confirmSaving}
          onClick={() => {
            setStep("pharmacy");
            setSelectedDate(null);
            setSelectedSlotId(null);
            setConfirmError(null);
          }}
        >
          ← Back to pharmacy
        </button>
        <button
          type="button"
          className={styles.btnConfirm}
          disabled={!canConfirm || confirmSaving}
          onClick={() => {
            setConfirmError(null);
            setInsuranceModalOpen(true);
          }}
        >
          {confirmSaving ? "Saving…" : "Continue"}
        </button>
      </div>

      {insuranceModalOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !confirmSaving) {
              setInsuranceModalOpen(false);
            }
          }}
        >
          <form
            className={styles.modalCard}
            onSubmit={(e) => {
              e.preventDefault();
              if (!insuranceComplete || confirmSaving) {
                return;
              }
              void onConfirmAppointment();
            }}
          >
            <h2 className={styles.modalTitle}>Insurance details</h2>
            <p className={styles.modalLead}>
              Our service provider requires these details before booking. You can find them on your insurance card.
            </p>
            {selectedSlotSummary ? (
              <p className={styles.selectedSummary}>
                Selected time: <strong>{selectedSlotSummary}</strong>
              </p>
            ) : null}
            {selectedPharmacy ? (
              <p className={styles.selectedSummary}>
                Pharmacy: <strong>{selectedPharmacy.name}</strong>
              </p>
            ) : null}

            <div className={styles.modalFields}>
              <label className={styles.field}>
                <span className={styles.label}>Member ID *</span>
                <input
                  className={styles.input}
                  required
                  autoComplete="off"
                  value={insurance.insurance_member_id}
                  onChange={(e) =>
                    setInsurance((p) => ({
                      ...p,
                      insurance_member_id: e.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Insurance plan name *</span>
                <input
                  className={styles.input}
                  required
                  autoComplete="off"
                  value={insurance.insurance_plan_name}
                  onChange={(e) =>
                    setInsurance((p) => ({
                      ...p,
                      insurance_plan_name: e.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Payer ID *</span>
                <input
                  className={styles.input}
                  required
                  autoComplete="off"
                  value={insurance.payer_identification}
                  onChange={(e) =>
                    setInsurance((p) => ({
                      ...p,
                      payer_identification: e.target.value,
                    }))
                  }
                />
                <span className={styles.fieldHint}>
                  Usually listed on the back of the card near claims or provider information.
                </span>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Coverage type *</span>
                <select
                  className={styles.select}
                  required
                  value={insurance.cover_type}
                  onChange={(e) =>
                    setInsurance((p) => ({ ...p, cover_type: e.target.value }))
                  }
                >
                  <option value="Primary">Primary</option>
                  <option value="Secondary">Secondary</option>
                </select>
              </label>
            </div>

            {confirmError ? (
              <p className={styles.confirmError} role="alert">
                {confirmError}
              </p>
            ) : null}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={confirmSaving}
                onClick={() => setInsuranceModalOpen(false)}
              >
                Back
              </button>
              <button
                type="submit"
                className={styles.btnConfirm}
                disabled={!insuranceComplete || confirmSaving}
              >
                {confirmSaving ? "Preparing checkout…" : "Continue to payment"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
