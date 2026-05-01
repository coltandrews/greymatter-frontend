"use client";

import { retryBookingIntentOla } from "@/lib/api/bookingIntents";
import {
  canRetryOlaBooking,
  recoveryDiagnosticDetails,
  recoveryBookingTime,
  recoveryBookingTitle,
  recoveryPharmacySummary,
  recoveryStateSummary,
  type StaffRecoveryBooking,
} from "@/lib/dashboard/recovery";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuditTrailPanel } from "./AuditTrailPanel";

type RetryAttempt = {
  at: string;
  status: "success" | "error";
  message: string;
};

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
  const [attemptsById, setAttemptsById] = useState<Record<string, RetryAttempt[]>>({});

  function addAttempt(rowId: string, attempt: Omit<RetryAttempt, "at">) {
    setAttemptsById((current) => ({
      ...current,
      [rowId]: [
        {
          ...attempt,
          at: new Date().toISOString(),
        },
        ...(current[rowId] ?? []),
      ].slice(0, 5),
    }));
  }

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
      addAttempt(row.id, {
        status: "success",
        message: "Retry succeeded. Refreshing status...",
      });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Retry failed.";
      setMessageById((current) => ({
        ...current,
        [row.id]: message,
      }));
      addAttempt(row.id, {
        status: "error",
        message,
      });
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
          {initialBookings.map((row) => {
            const attempts = attemptsById[row.id] ?? [];
            const details = recoveryDiagnosticDetails(row);
            return (
              <li
                key={row.id}
                style={{
                  display: "grid",
                  gap: 14,
                  padding: 16,
                  border: "1px solid #e5ebf5",
                  borderRadius: 10,
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: "#172033" }}>
                      {recoveryBookingTitle(row)}
                    </p>
                    <p style={{ margin: "0 0 4px", fontSize: 13, color: "#64748b" }}>
                      {recoveryBookingTime(row)}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                      {recoveryStateSummary(row)}
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
                      alignSelf: "flex-start",
                    }}
                  >
                    {retryingId === row.id ? "Retrying..." : "Retry Ola booking"}
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  <div style={{ padding: 12, borderRadius: 8, background: "#fff", border: "1px solid #e5ebf5" }}>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                      Pharmacy
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: "#172033", lineHeight: 1.45 }}>
                      {recoveryPharmacySummary(row)}
                    </p>
                  </div>
                  <div style={{ padding: 12, borderRadius: 8, background: "#fff", border: "1px solid #e5ebf5" }}>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                      Failure
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: "#b45309", lineHeight: 1.45 }}>
                      {details[0]?.value ?? "Ola booking did not complete."}
                    </p>
                  </div>
                </div>

                <dl
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    margin: 0,
                  }}
                >
                  {details.map((detail) => (
                    <div key={`${detail.label}-${detail.value}`}>
                      <dt style={{ marginBottom: 3, fontSize: 11, color: "#94a3b8", fontWeight: 800 }}>
                        {detail.label}
                      </dt>
                      <dd
                        style={{
                          margin: 0,
                          fontSize: detail.mono ? 11 : 13,
                          color: "#475569",
                          fontFamily: detail.mono ? "ui-monospace, monospace" : undefined,
                          wordBreak: "break-word",
                        }}
                      >
                        {detail.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                {messageById[row.id] ? (
                  <p role="status" style={{ margin: 0, fontSize: 13, color: "#475569" }}>
                    {messageById[row.id]}
                  </p>
                ) : null}

                {attempts.length > 0 ? (
                  <div style={{ borderTop: "1px solid #e5ebf5", paddingTop: 10 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                      Retry history
                    </p>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                      {attempts.map((attempt) => (
                        <li
                          key={`${attempt.at}-${attempt.message}`}
                          style={{
                            fontSize: 12,
                            color: attempt.status === "success" ? "#166534" : "#b91c1c",
                            lineHeight: 1.4,
                          }}
                        >
                          {new Date(attempt.at).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          {attempt.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <AuditTrailPanel
                  title="Booking audit trail"
                  target={{
                    patientUserId: row.user_id,
                    bookingIntentId: row.id,
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
