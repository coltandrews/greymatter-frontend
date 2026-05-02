"use client";

import {
  fetchBookingQueue,
  type BookingQueueResponse,
  type BookingQueueRow,
} from "@/lib/api/admin";
import {
  bookingQueuePatientLabel,
  bookingQueuePharmacyLabel,
  bookingQueueReference,
  bookingQueueSlotLabel,
  bookingQueueStatusView,
} from "@/lib/dashboard/bookingQueue";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import styles from "./dashboard.module.css";

export type SubmissionRecord = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type UnifiedSubmissionRow =
  | {
      kind: "booking";
      id: string;
      patient: string;
      status: string;
      statusTone: {
        background: string;
        color: string;
      };
      detail: string;
      pharmacy: string;
      updatedAt: string;
      reference: string;
    }
  | {
      kind: "intake";
      id: string;
      patient: string;
      status: string;
      statusTone: {
        background: string;
        color: string;
      };
      detail: string;
      pharmacy: string;
      updatedAt: string;
      reference: string;
    };

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

async function readBackendMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null) as { message?: unknown } | null;
  return typeof body?.message === "string" && body.message.trim()
    ? body.message
    : `Care activity failed (${res.status}).`;
}

function bookingRow(row: BookingQueueRow): UnifiedSubmissionRow {
  const status = bookingQueueStatusView(row);
  return {
    kind: "booking",
    id: `booking-${row.id}`,
    patient: bookingQueuePatientLabel(row),
    status: status.label,
    statusTone: {
      background: status.background,
      color: status.color,
    },
    detail: bookingQueueSlotLabel(row),
    pharmacy: bookingQueuePharmacyLabel(row),
    updatedAt: row.updatedAt,
    reference: bookingQueueReference(row),
  };
}

function intakeRow(row: SubmissionRecord): UnifiedSubmissionRow {
  return {
    kind: "intake",
    id: `intake-${row.id}`,
    patient: row.user_id,
    status: row.status.replace("_", " "),
    statusTone: {
      background: "#eef2ff",
      color: "#4338ca",
    },
    detail: "Intake record",
    pharmacy: "Not selected",
    updatedAt: row.updated_at,
    reference: row.id,
  };
}

export function SubmissionsPanel({
  initialSubmissions,
  submissionsError,
}: {
  initialSubmissions: SubmissionRecord[];
  submissionsError: string | null;
}) {
  const [bookings, setBookings] = useState<BookingQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingError, setBookingError] = useState<string | null>(null);

  async function loadBookings() {
    setLoading(true);
    setBookingError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to load care activity.");
      }

      const response = await fetchBookingQueue(session.access_token, 100);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }

      const payload = await response.json() as BookingQueueResponse;
      setBookings(payload.rows ?? []);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Could not load care activity.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  const rows = useMemo(
    () =>
      [
        ...bookings.map(bookingRow),
        ...initialSubmissions.map(intakeRow),
      ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [bookings, initialSubmissions],
  );

  const displayError = bookingError ?? submissionsError;

  return (
    <section aria-labelledby="submissions-title">
      <div className={styles.workspaceHeader}>
        <div>
          <h2 id="submissions-title" className={styles.workspaceTitle}>
            Care Activity
          </h2>
          <p className={styles.compactText}>
            {loading ? "Loading care activity..." : `${rows.length} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBookings()}
          disabled={loading}
          className={styles.smallAction}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {displayError ? (
        <p role="alert" className={styles.inlineError}>
          {displayError}
        </p>
      ) : null}

      {!displayError && rows.length === 0 ? (
        <p className={styles.emptyText}>No care activity yet.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Patient</th>
                <th>Status</th>
                <th>Details</th>
                <th>Pharmacy</th>
                <th>Updated</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.kind === "booking" ? "Booking request" : "Intake form"}</td>
                  <td className={row.kind === "intake" ? styles.monoCell : undefined}>
                    {row.patient}
                  </td>
                  <td>
                    <span
                      className={styles.statusBadge}
                      style={{
                        background: row.statusTone.background,
                        color: row.statusTone.color,
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>{row.detail}</td>
                  <td>{row.pharmacy}</td>
                  <td>{formatWhen(row.updatedAt)}</td>
                  <td className={styles.monoCell} title={row.reference}>
                    {row.reference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
