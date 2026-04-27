"use client";

import {
  createVendorOlaScheduleRequest,
  fetchVendorOlaSchedules,
} from "@/lib/api/vendorOla";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { APPOINTMENT_QUESTIONS } from "@/lib/scheduling/appointmentQuestions";
import {
  availableDatesFromOlaScheduleResponse,
  slotsFromOlaScheduleResponse,
  type SlotDisplay,
} from "@/lib/scheduling/olaProviderSchedules";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./schedule.module.css";

type Step = "intake" | "calendar";

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

function answerLabel(id: string, value: string): string {
  const q = APPOINTMENT_QUESTIONS.find((item) => item.id === id);
  if (!q || q.type !== "select") {
    return value;
  }
  return q.options.find((opt) => opt.value === value)?.label ?? value;
}

function buildOlaAppointmentPayload({
  answers,
  email,
  patient,
  selectedSlot,
  slot,
  userInsurance,
}: {
  answers: Record<string, string>;
  email: string;
  patient: IntakeDraftData;
  selectedSlot: string;
  slot: SlotDisplay;
  userInsurance: InsuranceForm;
}) {
  const state = patient.service_state?.trim() || patient.address_state?.trim() || "";
  const street = patient.street_address?.trim() || "";
  const city = patient.city?.trim() || "";
  const zip = patient.zip?.trim() || "";
  return {
    user_data: {
      first_name: patient.legal_first_name?.trim() || "Patient",
      last_name: patient.legal_last_name?.trim() || "",
      gender: patient.gender?.trim() || "",
      dob: patient.date_of_birth?.trim() || "",
      email,
      phone: patient.phone?.trim() || "",
      role: "USER",
      sub_role: "",
      release_medical: false,
      tennant: "grey_matter",
    },
    address: [
      {
        use: "home",
        text: [street, city, state, zip].filter(Boolean).join(" "),
        street1: street,
        city,
        state,
        postalCode: zip,
        line: [street, city, state, zip].filter(Boolean),
        type: "both",
      },
    ],
    service_data: {
      question_answer: Object.entries(answers)
        .filter(([, value]) => value.trim())
        .map(([id, value]) => {
          const question = APPOINTMENT_QUESTIONS.find((q) => q.id === id);
          return {
            question_text: question?.label ?? id,
            answer: answerLabel(id, value),
            other_text: "",
          };
        }),
    },
    identifier: {
      service: "grey-matter-semaglutide-injection-one-month",
      sessionType: "initial",
      tennant: "grey_matter",
      scheduleType: "one-time",
    },
    transaction_id: crypto.randomUUID(),
    pharmacyDetails: {},
    schedule: {
      schedule_start_date: selectedSlot,
      schedule_end_date: slot.end,
      provider_guid: slot.providerGuid ?? "",
    },
    user_insurance: {
      insurance_member_id: userInsurance.insurance_member_id.trim(),
      insurance_plan_name: userInsurance.insurance_plan_name.trim(),
      payer_identification: userInsurance.payer_identification.trim(),
      cover_type: userInsurance.cover_type.trim(),
    },
  };
}

export function ScheduleFlow({
  email,
  patient,
  serviceState,
}: {
  email: string;
  patient: IntakeDraftData;
  serviceState: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intake");
  const [answers, setAnswers] = useState<Record<string, string>>({});
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
      setStep("calendar");
    },
    [intakeValid, scheduleBlockedReason],
  );

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
    if (!selectedDate || !selectedSlot || confirmSaving) {
      return;
    }
    setConfirmError(null);
    setConfirmSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        setConfirmError("You must be signed in to book.");
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setConfirmError("Sign in again to book.");
        return;
      }
      const starts = new Date(selectedSlot.start);
      if (Number.isNaN(starts.getTime())) {
        setConfirmError("That time slot is invalid. Pick another time.");
        return;
      }
      const vendorRes = await createVendorOlaScheduleRequest(
        session.access_token,
        buildOlaAppointmentPayload({
          answers,
          email,
          patient,
          selectedSlot: selectedSlot.start,
          slot: selectedSlot,
          userInsurance: insurance,
        }),
      );
      if (!vendorRes.ok) {
        setConfirmError(await vendorResponseErrorMessage(vendorRes));
        return;
      }
      const vendorJson = (await vendorRes.json().catch(() => ({}))) as Record<string, unknown>;
      const providerName = selectedSlot.provider?.trim() || null;
      const { error: insertError } = await supabase.from("appointments").insert({
        user_id: user.id,
        starts_at: starts.toISOString(),
        status: "booked",
        provider_name: providerName,
        ola_redirect_url:
          typeof vendorJson.redirectUrl === "string" ? vendorJson.redirectUrl : null,
        ola_popup_message:
          typeof vendorJson.popupMsg === "string" ? vendorJson.popupMsg : null,
        ola_user_guid:
          typeof vendorJson.user_guid === "string" ? vendorJson.user_guid : null,
        ola_order_guid:
          typeof vendorJson.data === "string" ? vendorJson.data : null,
      });
      if (insertError) {
        setConfirmError(insertError.message);
        return;
      }
      const q = new URLSearchParams({
        date: selectedDate,
        t: selectedSlot.start,
      });
      if (selectedSlot.label) {
        q.set("time", selectedSlot.label);
      }
      router.push(`/schedule/confirmed?${q.toString()}`);
    } finally {
      setConfirmSaving(false);
    }
  }, [answers, email, insurance, patient, router, selectedDate, selectedSlot, confirmSaving]);

  if (step === "intake") {
    return (
      <>
        <h1 className={styles.title}>Schedule appointment</h1>
        <p className={styles.stepHint}>
          Step 1 of 2 — a few questions for this visit.
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
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={!intakeValid || Boolean(scheduleBlockedReason)}
            >
              Continue to calendar
            </button>
            <Link href="/hub" className={styles.btnGhost}>
              Cancel
            </Link>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>Choose date &amp; time</h1>
      <p className={styles.stepHint}>
        Step 2 of 2 — pick a day, then a time.
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
            setStep("intake");
            setSelectedDate(null);
            setSelectedSlotId(null);
            setConfirmError(null);
          }}
        >
          ← Back to questions
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
          {confirmSaving ? "Saving…" : selectedSlotId ? "Continue" : "Select a time"}
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
                {confirmSaving ? "Booking…" : "Book appointment"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
