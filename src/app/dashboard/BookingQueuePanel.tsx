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
import { useEffect, useState } from "react";

function formatUpdated(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

async function readBackendMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null) as { message?: unknown } | null;
  return typeof body?.message === "string" && body.message.trim()
    ? body.message
    : `Booking queue failed (${res.status}).`;
}

export function BookingQueuePanel() {
  const [rows, setRows] = useState<BookingQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to load the booking queue.");
      }

      const response = await fetchBookingQueue(session.access_token, 100);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }

      const payload = await response.json() as BookingQueueResponse;
      setRows(payload.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load booking queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  return (
    <section style={{ margin: "0 0 28px" }} aria-labelledby="booking-queue-title">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <h2 id="booking-queue-title" style={{ margin: "0 0 6px", fontSize: 18 }}>
            Booking queue
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            {loading ? "Loading booking requests..." : `${rows.length} active request${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadQueue();
          }}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #dbe3ef",
            background: loading ? "#f1f5f9" : "#fff",
            color: "#172033",
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <p role="alert" style={{ margin: "0 0 12px", color: "#b91c1c", fontSize: 14 }}>
          {error}
        </p>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 15, color: "#64748b" }}>
          No active booking requests.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid #e5ebf5",
            borderRadius: 10,
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 980,
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5ebf5", background: "#f8fafc" }}>
                <th style={{ padding: "10px 12px", color: "#64748b", fontWeight: 700 }}>
                  Patient
                </th>
                <th style={{ padding: "10px 12px", color: "#64748b", fontWeight: 700 }}>
                  Status
                </th>
                <th style={{ padding: "10px 12px", color: "#64748b", fontWeight: 700 }}>
                  Slot
                </th>
                <th style={{ padding: "10px 12px", color: "#64748b", fontWeight: 700 }}>
                  Pharmacy
                </th>
                <th style={{ padding: "10px 12px", color: "#64748b", fontWeight: 700 }}>
                  State
                </th>
                <th style={{ padding: "10px 12px", color: "#64748b", fontWeight: 700 }}>
                  Updated
                </th>
                <th style={{ padding: "10px 12px", color: "#64748b", fontWeight: 700 }}>
                  Reference
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = bookingQueueStatusView(row);
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px", color: "#172033", fontWeight: 700 }}>
                      {bookingQueuePatientLabel(row)}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: status.background,
                          color: status.color,
                          fontSize: 11,
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: "#475569" }}>
                      {bookingQueueSlotLabel(row)}
                    </td>
                    <td style={{ padding: "12px", color: "#475569" }}>
                      {bookingQueuePharmacyLabel(row)}
                    </td>
                    <td style={{ padding: "12px", color: "#475569" }}>
                      {row.serviceState ?? "—"}
                    </td>
                    <td style={{ padding: "12px", color: "#475569" }}>
                      {formatUpdated(row.updatedAt)}
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        color: row.hasNextSteps ? "#92400e" : "#64748b",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 11,
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={bookingQueueReference(row)}
                    >
                      {bookingQueueReference(row)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
