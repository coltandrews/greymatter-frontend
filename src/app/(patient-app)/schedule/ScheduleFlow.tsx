"use client";

import { fetchVendorOlaSchedules } from "@/lib/api/vendorOla";
import { APPOINTMENT_QUESTIONS } from "@/lib/scheduling/appointmentQuestions";
import {
  buildFixtureOlaProviderSchedules,
  olaSchedulesLiveEnabled,
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

export function ScheduleFlow({
  serviceState,
  serviceId,
}: {
  serviceState: string | null;
  serviceId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intake");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDisplay[]>([]);
  const [slotsSource, setSlotsSource] = useState<"fixture" | "live">("fixture");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const effectiveState = (serviceState ?? "").trim() || "CA";

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
      if (!intakeValid) {
        return;
      }
      setStep("calendar");
    },
    [intakeValid],
  );

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSlots(true);
      setSelectedSlot(null);
      const fixture = buildFixtureOlaProviderSchedules(selectedDate);
      let parsed = slotsFromOlaScheduleResponse(fixture, selectedDate);
      let source: "fixture" | "live" = "fixture";

      try {
        if (olaSchedulesLiveEnabled()) {
          const supabase = createClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
          const sid = (serviceId ?? "").trim();
          if (session?.access_token && base && sid && sid !== "placeholder-service-id") {
            const res = await fetchVendorOlaSchedules(
              session.access_token,
              effectiveState,
              sid,
            );
            if (res.ok) {
              const liveJson: unknown = await res.json();
              const liveParsed = slotsFromOlaScheduleResponse(liveJson, selectedDate);
              if (liveParsed.length > 0) {
                parsed = liveParsed;
                source = "live";
              }
            }
          }
        }
      } catch {
        /* keep fixture */
      }

      if (!cancelled) {
        setSlots(parsed);
        setSlotsSource(source);
        setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, effectiveState, serviceId]);

  const canConfirm =
    Boolean(selectedDate && selectedSlot && !loadingSlots);

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
          Step 1 of 2 — a few questions for this visit. (Questions will be configurable later.)
        </p>
        {serviceState ? (
          <p className={styles.stateNote}>
            Using service state <strong>{serviceState}</strong> from your profile for availability.
          </p>
        ) : (
          <p className={styles.stateNote}>
            No state on file; using <strong>{effectiveState}</strong> for demo availability. Update
            intake if needed.
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
            <button type="submit" className={styles.btnPrimary} disabled={!intakeValid}>
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
        Step 2 of 2 — pick a day, then a time.{" "}
        {slotsSource === "live"
          ? "Times from the live Ola schedule API (via our backend)."
          : "Sample times use the same JSON structure as Ola’s provider schedules until the live API is on."}
      </p>
      <div className={styles.calendarCard}>
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
            return (
              <button
                key={cell.iso}
                type="button"
                className={`${styles.dayCell} ${cell.disabled ? styles.dayCellDisabled : ""} ${selected ? styles.dayCellSelected : ""}`}
                disabled={cell.disabled}
                onClick={() => setSelectedDate(cell.iso)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        {selectedDate ? (
          <div className={styles.slotsSection}>
            <p className={styles.slotsTitle}>
              {loadingSlots
                ? "Loading times…"
                : `Times for ${new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}`}
            </p>
            {!loadingSlots && slots.length === 0 ? (
              <p className={styles.stepHint}>No open slots that day. Try another date.</p>
            ) : null}
            {!loadingSlots && slots.length > 0 ? (
              <ul className={styles.slotList}>
                {slots.map((s) => (
                  <li key={s.start}>
                    <button
                      type="button"
                      className={`${styles.slotBtn} ${selectedSlot === s.start ? styles.slotBtnSelected : ""}`}
                      onClick={() => setSelectedSlot(s.start)}
                    >
                      {s.label}
                      {s.provider ? ` · ${s.provider}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className={styles.olaNote}>
              Booking is saved in your hub. Ola &quot;new schedule request&quot; can use the same slot fields
              (start/end, provider_guid) when we turn that on.
            </p>
          </div>
        ) : null}
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
          {confirmSaving ? "Saving…" : "Confirm appointment"}
        </button>
      </div>
    </>
  );
}
