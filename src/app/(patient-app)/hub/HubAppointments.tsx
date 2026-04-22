"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import styles from "./hub.module.css";

export type HubAppointmentRow = {
  id: string;
  status: string;
  starts_at: string;
  created_at: string;
  updated_at: string;
  provider_name: string | null;
};

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

export function HubAppointments({
  appointments: initial,
}: {
  appointments: HubAppointmentRow[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState<HubAppointmentRow | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const closeDetail = useCallback(() => {
    setSelected(null);
    setConfirmCancel(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!selected && !confirmCancel) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (confirmCancel) {
          setConfirmCancel(false);
        } else {
          closeDetail();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, confirmCancel, closeDetail]);

  async function confirmCancellation() {
    if (!selected || selected.status !== "booked") {
      return;
    }
    setError(null);
    setCancelling(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCancelling(false);
      setError("Not signed in.");
      return;
    }

    const { error: upErr } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", selected.id)
      .eq("user_id", user.id);

    setCancelling(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }

    const updated = { ...selected, status: "cancelled" };
    setItems((prev) => prev.map((r) => (r.id === selected.id ? updated : r)));
    setSelected(updated);
    setConfirmCancel(false);
    router.refresh();
  }

  return (
    <>
      <ul className={styles.visitList}>
        {items.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className={`${styles.visitItem} ${styles.visitItemButton} ${r.status === "cancelled" ? styles.visitItemCancelled : ""}`}
              onClick={() => {
                setError(null);
                setConfirmCancel(false);
                setSelected(r);
              }}
            >
              <div className={styles.visitTop}>
                <div className={styles.visitLeft}>
                  <div className={styles.visitRowLine}>
                    <span className={styles.statusPill}>{r.status}</span>
                    <span className={styles.visitDoctor}>
                      {r.provider_name?.trim() || "Provider not set"}
                    </span>
                  </div>
                  <span className={styles.visitHint}>Click to view details</span>
                </div>
                <span className={styles.visitTime}>{formatListTime(r.starts_at)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>

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

            <p className={styles.modalNote}>
              Cancelling here updates your Greymatter record. Ola&apos;s published OpenAPI shows
              order status and a <code className={styles.inlineCode}>cancellation_reason</code> field
              on <strong>GET</strong> orders—not a cancel endpoint we can call yet.
            </p>

            {error ? (
              <p className={styles.modalError} role="alert">
                {error}
              </p>
            ) : null}

            <div className={styles.modalActions}>
              {selected.status === "booked" ? (
                <button
                  type="button"
                  className={styles.btnDanger}
                  onClick={() => {
                    setError(null);
                    setConfirmCancel(true);
                  }}
                >
                  Cancel appointment
                </button>
              ) : null}
              <button type="button" className={styles.btnSecondary} onClick={closeDetail}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmCancel && selected?.status === "booked" ? (
        <div
          className={`${styles.modalBackdrop} ${styles.modalBackdropConfirm}`}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmCancel(false);
            }
          }}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cancel-confirm-title" className={styles.modalTitle}>
              Cancel this appointment?
            </h3>
            <p className={styles.confirmBody}>
              {formatWhenShort(selected.starts_at)}
              {selected.provider_name?.trim()
                ? ` · ${selected.provider_name.trim()}`
                : ""}{" "}
              — this cannot be undone here. You may need to book a new visit if you change your mind.
            </p>
            {error ? (
              <p className={styles.modalError} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnDanger}
                disabled={cancelling}
                onClick={() => {
                  void confirmCancellation();
                }}
              >
                {cancelling ? "Cancelling…" : "Yes, cancel appointment"}
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={cancelling}
                onClick={() => setConfirmCancel(false)}
              >
                Keep appointment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
