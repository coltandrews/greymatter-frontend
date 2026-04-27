"use client";

import { fetchVendorOlaSchedules } from "@/lib/api/vendorOla";
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
    return `Ola availability request failed (${res.status}).`;
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
      return `Ola availability request failed (${res.status}): ${message}`;
    }
  } catch {
    /* use raw response text */
  }

  return `Ola availability request failed (${res.status}): ${raw}`;
}

export function ScheduleFlow({
  serviceState,
}: {
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
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
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
      setSelectedSlot(null);
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
              : "Could not load availability from Ola.",
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
      setSelectedSlot(null);
      setSlotsError(null);
      return;
    }
    if (availabilityError) {
      setSlots([]);
      setSelectedSlot(null);
      setSlotsError(availabilityError);
      return;
    }
    if (loadingAvailability || !scheduleResponse) {
      setSlots([]);
      setSelectedSlot(null);
      setSlotsError(null);
      return;
    }
    setSlots(slotsFromOlaScheduleResponse(scheduleResponse, selectedDate));
    setSelectedSlot(null);
    setSlotsError(null);
  }, [availabilityError, loadingAvailability, scheduleResponse, selectedDate]);

  const canConfirm =
    Boolean(selectedDate && selectedSlot && !loadingAvailability);

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
      const starts = new Date(selectedSlot);
      if (Number.isNaN(starts.getTime())) {
        setConfirmError("That time slot is invalid. Pick another time.");
        return;
      }
      const slotRow = slots.find((s) => s.start === selectedSlot);
      const providerName = slotRow?.provider?.trim() || null;
      const { error: insertError } = await supabase.from("appointments").insert({
        user_id: user.id,
        starts_at: starts.toISOString(),
        status: "booked",
        provider_name: providerName,
      });
      if (insertError) {
        setConfirmError(insertError.message);
        return;
      }
      const q = new URLSearchParams({
        date: selectedDate,
        t: selectedSlot,
      });
      if (slotRow?.label) {
        q.set("time", slotRow.label);
      }
      router.push(`/schedule/confirmed?${q.toString()}`);
    } finally {
      setConfirmSaving(false);
    }
  }, [router, selectedDate, selectedSlot, slots, confirmSaving]);

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
                  <li key={s.start}>
                    <button
                      type="button"
                      className={`${styles.slotBtn} ${selectedSlot === s.start ? styles.slotBtnSelected : ""}`}
                      onClick={() => setSelectedSlot(s.start)}
                      aria-pressed={selectedSlot === s.start}
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
            setSelectedSlot(null);
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
            void onConfirmAppointment();
          }}
        >
          {confirmSaving ? "Saving…" : selectedSlot ? "Continue" : "Select a time"}
        </button>
      </div>
    </>
  );
}
