"use client";

import {
  fetchPatientLookup,
  type PatientLookupPatient,
  type PatientLookupResponse,
} from "@/lib/api/admin";
import {
  bookingQueuePharmacyLabel,
  bookingQueueSlotLabel,
  bookingQueueStatusView,
} from "@/lib/dashboard/bookingQueue";
import {
  patientLookupActivitySummary,
  patientLookupAppointmentLabel,
  patientLookupReference,
  patientLookupSummary,
} from "@/lib/dashboard/patientLookup";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { AuditTrailPanel } from "./AuditTrailPanel";

async function readBackendMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null) as { message?: unknown } | null;
  return typeof body?.message === "string" && body.message.trim()
    ? body.message
    : `Patient lookup failed (${res.status}).`;
}

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

function PatientResult({ patient }: { patient: PatientLookupPatient }) {
  return (
    <article
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
          <h3 style={{ margin: "0 0 5px", fontSize: 15, color: "#172033" }}>
            {patient.name}
          </h3>
          <p style={{ margin: "0 0 5px", fontSize: 13, color: "#64748b" }}>
            {patientLookupSummary(patient)}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>
            {patientLookupReference(patient)}
          </p>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#475569", fontWeight: 800 }}>
          {patientLookupActivitySummary(patient)}
        </p>
      </div>

      {patient.bookings.length > 0 ? (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b", fontWeight: 800 }}>
            Bookings
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {patient.bookings.map((booking) => {
              const status = bookingQueueStatusView(booking);
              return (
                <li
                  key={booking.id}
                  style={{
                    display: "grid",
                    gap: 5,
                    padding: 12,
                    background: "#fff",
                    border: "1px solid #e5ebf5",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "#172033", fontWeight: 800 }}>
                      {bookingQueueSlotLabel(booking)}
                    </span>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: status.background,
                        color: status.color,
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                    {bookingQueuePharmacyLabel(booking)}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>
                    {booking.olaOrderGuid || booking.id}
                    {booking.hasNextSteps ? " · next steps" : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {patient.appointments.length > 0 ? (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b", fontWeight: 800 }}>
            Appointments
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {patient.appointments.map((appointment) => (
              <li
                key={appointment.id}
                style={{
                  padding: 12,
                  background: "#fff",
                  border: "1px solid #e5ebf5",
                  borderRadius: 8,
                }}
              >
                <p style={{ margin: "0 0 5px", fontSize: 13, color: "#172033", fontWeight: 800 }}>
                  {patientLookupAppointmentLabel(appointment)}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                  Status {appointment.status ?? "unknown"} · Updated {formatUpdated(appointment.updatedAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AuditTrailPanel
        title="Patient audit trail"
        target={{ patientUserId: patient.userId }}
      />
    </article>
  );
}

export function PatientLookupPanel() {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientLookupPatient[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const trimmed = query.trim();
    if (trimmed.length < 2 || loading) {
      setError("Enter at least 2 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to search patients.");
      }

      const response = await fetchPatientLookup(session.access_token, trimmed);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }
      const payload = await response.json() as PatientLookupResponse;
      setPatients(payload.patients ?? []);
    } catch (err) {
      setPatients([]);
      setError(err instanceof Error ? err.message : "Could not search patients.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ margin: "0 0 28px" }} aria-labelledby="patient-lookup-title">
      <h2 id="patient-lookup-title" style={{ margin: "0 0 8px", fontSize: 18 }}>
        Patient lookup
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search email, name, or user ID"
          style={{
            minWidth: 0,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #dbe3ef",
            fontSize: 14,
            color: "#172033",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #172033",
            background: loading ? "#94a3b8" : "#172033",
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error ? (
        <p role="alert" style={{ margin: "0 0 12px", color: "#b91c1c", fontSize: 14 }}>
          {error}
        </p>
      ) : null}

      {searched && !loading && !error && patients.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          No matching patients found.
        </p>
      ) : null}

      {patients.length > 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          {patients.map((patient) => (
            <PatientResult key={patient.userId} patient={patient} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
