"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import styles from "./hub.module.css";

export type HubAppointmentRow = {
  id: string;
  status: string;
  starts_at: string;
  created_at: string;
  updated_at: string;
  provider_name: string | null;
  ola_redirect_url: string | null;
  ola_popup_message: string | null;
  ola_order_guid: string | null;
};

function mapRows(data: unknown[]): HubAppointmentRow[] {
  return data.map((r) => {
    const o = r as Record<string, unknown>;
    return {
      id: String(o.id),
      status: String(o.status),
      starts_at: String(o.starts_at),
      created_at: String(o.created_at),
      updated_at: String(o.updated_at),
      provider_name:
        o.provider_name == null ? null : String(o.provider_name),
      ola_redirect_url:
        o.ola_redirect_url == null ? null : String(o.ola_redirect_url),
      ola_popup_message:
        o.ola_popup_message == null ? null : String(o.ola_popup_message),
      ola_order_guid:
        o.ola_order_guid == null ? null : String(o.ola_order_guid),
    };
  });
}

async function loadAppointmentsFromSupabase(): Promise<{
  rows: HubAppointmentRow[];
  error: string | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { rows: [], error: null };
  }
  const { data, error } = await supabase
    .from("appointments")
    .select("id, status, starts_at, created_at, updated_at, provider_name, ola_redirect_url, ola_popup_message, ola_order_guid")
    .eq("user_id", user.id)
    .order("starts_at", { ascending: true });

  if (error) {
    return { rows: [], error: error.message };
  }
  return { rows: mapRows(data ?? []), error: null };
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatWhenShort(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatListTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ordinalDay(day: number) {
  if (day > 3 && day < 21) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function formatListDate(iso: string) {
  try {
    const date = new Date(iso);
    const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
    const month = date.toLocaleDateString(undefined, { month: "long" });
    return `${weekday}, ${month} ${ordinalDay(date.getDate())}`;
  } catch {
    return iso;
  }
}

export function HubAppointments({
  initial,
  serverLoadError,
}: {
  initial: HubAppointmentRow[];
  serverLoadError: string | null;
}) {
  const [items, setItems] = useState(initial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HubAppointmentRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { rows, error: e } = await loadAppointmentsFromSupabase();
      if (cancelled) {
        return;
      }
      if (e) {
        setLoadError(e);
        return;
      }
      setLoadError(null);
      setItems(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeDetail = useCallback(() => {
    setSelected(null);
  }, []);

  useEffect(() => {
    if (!selected) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeDetail();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, closeDetail]);

  const displayError = serverLoadError ?? loadError;

  if (displayError) {
    return <p className={styles.error}>{displayError}</p>;
  }

  const visitCount = items.length;

  return (
    <>
      {visitCount > 0 ? (
        <div className={styles.listToolbar}>
          <p className={styles.listHeading}>Your list</p>
          <span className={styles.badge}>
            {visitCount} {visitCount === 1 ? "appointment" : "appointments"}
          </span>
        </div>
      ) : null}

      {visitCount === 0 ? (
        <p className={styles.emptyState}>
          You don&apos;t have any appointments here yet. Use{" "}
          <strong>+ Schedule Appointment</strong> to book one—they&apos;ll show up here.
        </p>
      ) : (
        <ul className={styles.visitList}>
          {items.map((r) => (
            <li key={r.id} className={styles.visitRow}>
              <button
                type="button"
                className={`${styles.visitItem} ${styles.visitItemButton}`}
                onClick={() => {
                  setSelected(r);
                }}
              >
                <div className={styles.visitTop}>
                  <div className={styles.visitLeft}>
                    <div className={styles.visitRowLine}>
                      <span className={styles.statusPill}>
                        {r.status === "booked" ? "Confirmed" : r.status}
                      </span>
                      <span className={styles.visitDoctor}>
                        {r.provider_name?.trim() || "Provider not set"}
                      </span>
                    </div>
                    {r.ola_popup_message ? (
                      <p className={styles.consultMessage}>
                        &ldquo;{r.ola_popup_message}&rdquo;
                      </p>
                    ) : null}
                  </div>
                  <div className={styles.visitTimeBlock}>
                    <span className={styles.visitTime}>{formatListTime(r.starts_at)}</span>
                    <span className={styles.visitDate}>{formatListDate(r.starts_at)}</span>
                  </div>
                </div>
              </button>
              {r.ola_redirect_url ? (
                <a
                  className={styles.nextStepsLink}
                  href={r.ola_redirect_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className={styles.nextStepsText}>Next Steps</span>
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDetail();
            }
          }}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="appt-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="appt-detail-title" className={styles.modalTitle}>
              Appointment details
            </h3>

            <dl className={styles.detailList}>
              <div className={styles.detailRow}>
                <dt>Scheduled</dt>
                <dd>{formatWhen(selected.starts_at)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Clinician</dt>
                <dd>{selected.provider_name?.trim() || "—"}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Status</dt>
                <dd className={styles.detailCap}>{selected.status}</dd>
              </div>
              {selected.ola_redirect_url ? (
                <div className={styles.detailRow}>
                  <dt>Next steps</dt>
                  <dd>
                    <a
                      className={styles.detailLink}
                      href={selected.ola_redirect_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open next steps
                    </a>
                  </dd>
                </div>
              ) : null}
              {selected.ola_popup_message ? (
                <div className={styles.detailRow}>
                  <dt>Service provider message</dt>
                  <dd>{selected.ola_popup_message}</dd>
                </div>
              ) : null}
              <div className={styles.detailRow}>
                <dt>Reference ID</dt>
                <dd className={styles.detailMono}>{selected.id}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Booked</dt>
                <dd>{formatWhenShort(selected.created_at)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Last updated</dt>
                <dd>{formatWhenShort(selected.updated_at)}</dd>
              </div>
            </dl>

            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={closeDetail}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
