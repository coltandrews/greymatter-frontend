"use client";

import { retryBookingIntentOla } from "@/lib/api/bookingIntents";
import {
  canRetryOlaBooking,
  recoveryBookingTime,
  recoveryBookingTitle,
  type StaffRecoveryBooking,
} from "@/lib/dashboard/recovery";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

function formatReason(reason: string | null): string {
  return reason?.trim() || "Ola booking did not complete.";
}

async function backendErrorMessage(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  if (!raw.trim()) {
    return `Retry failed (${res.status}).`;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.message === "string" && obj.message.trim()) {
        return obj.message;
      }
    }
  } catch {
    /* use raw response */
  }
  return raw;
}

export function StaffRecoveryPanel({
  initialBookings,
}: {
  initialBookings: StaffRecoveryBooking[];
}) {
  const router = useRouter();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [messageById, setMessageById] = useState<Record<string, string>>({});

  async function retry(row: StaffRecoveryBooking) {
    if (!canRetryOlaBooking(row) || retryingId) {
      return;
    }
    setRetryingId(row.id);
    setMessageById((current) => ({ ...current, [row.id]: "" }));
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to retry booking.");
      }

      const response = await retryBookingIntentOla(session.access_token, row.id);
      if (!response.ok) {
        throw new Error(await backendErrorMessage(response));
      }

      setMessageById((current) => ({
        ...current,
        [row.id]: "Retry succeeded. Refreshing status...",
      }));
      router.refresh();
    } catch (err) {
      setMessageById((current) => ({
        ...current,
        [row.id]: err instanceof Error ? err.message : "Retry failed.",
      }));
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <section style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #e5ebf5" }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Booking recovery</h2>
      <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
        Paid bookings that need staff review before Ola confirmation.
      </p>

      {initialBookings.length === 0 ? (
        <p style={{ margin: 0, fontSize: 15, color: "#64748b" }}>
          No booking recoveries right now.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {initialBookings.map((row) => (
            <li
              key={row.id}
              style={{
                display: "grid",
                gap: 10,
                padding: 14,
                border: "1px solid #e5ebf5",
                borderRadius: 10,
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#172033" }}>
                    {recoveryBookingTitle(row)}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                    {recoveryBookingTime(row)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canRetryOlaBooking(row) || retryingId === row.id}
                  onClick={() => {
                    void retry(row);
                  }}
                  style={{
                    padding: "9px 13px",
                    borderRadius: 8,
                    border: "1px solid #172033",
                    background: retryingId === row.id ? "#94a3b8" : "#172033",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: retryingId === row.id ? "not-allowed" : "pointer",
                  }}
                >
                  {retryingId === row.id ? "Retrying..." : "Retry Ola booking"}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#b45309", lineHeight: 1.45 }}>
                {formatReason(row.failure_reason)}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
                {row.id}
              </p>
              {messageById[row.id] ? (
                <p role="status" style={{ margin: 0, fontSize: 13, color: "#475569" }}>
                  {messageById[row.id]}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
