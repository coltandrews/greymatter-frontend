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
import { useEffect, useMemo, useState } from "react";
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

function latestPatientUpdate(patient: PatientLookupPatient): string | null {
  const dates = [
    patient.latestSubmission?.updatedAt,
    ...patient.bookings.map((booking) => booking.updatedAt),
    ...patient.appointments.map((appointment) => appointment.updatedAt),
  ].filter((value): value is string => Boolean(value));

  return dates
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function patientMatchesFilter(patient: PatientLookupPatient, search: string, state: string): boolean {
  const normalized = search.trim().toLowerCase();
  const stateMatches = !state || patient.serviceState === state;
  if (!stateMatches) {
    return false;
  }

  if (!normalized) {
    return true;
  }

  return [
    patient.name,
    patient.email,
    patient.userId,
    patient.serviceState,
    patient.gender,
    genderLabel(patient.gender),
    ageRangeForPatient(patient),
    patient.latestSubmission?.status,
    patientLookupActivitySummary(patient),
  ].some((value) => value?.toLowerCase().includes(normalized));
}

function uniquePatientStates(patients: PatientLookupPatient[]): string[] {
  return Array.from(new Set(
    patients
      .map((patient) => patient.serviceState)
      .filter((value): value is string => Boolean(value)),
  )).sort((a, b) => a.localeCompare(b));
}

function statusLabel(value: string | null | undefined): string {
  return value?.replace(/_/g, " ") || "Not started";
}

function ageFromDateOfBirth(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const birthdayPassed =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!birthdayPassed) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

function ageRangeForPatient(patient: PatientLookupPatient): string {
  const age = ageFromDateOfBirth(patient.dateOfBirth);
  if (age == null) {
    return "Unknown";
  }
  if (age < 18) {
    return "Under 18";
  }
  if (age <= 29) {
    return "18-29";
  }
  if (age <= 39) {
    return "30-39";
  }
  if (age <= 49) {
    return "40-49";
  }
  if (age <= 59) {
    return "50-59";
  }
  if (age <= 69) {
    return "60-69";
  }
  return "70+";
}

function genderLabel(value: string | null): string {
  switch (value) {
    case "male":
      return "Male";
    case "female":
      return "Female";
    case "non_binary":
      return "Non-binary";
    case "prefer_not":
      return "Prefer not to say";
    default:
      return value?.replace(/_/g, " ") || "Unknown";
  }
}

function countBy<T>(items: T[], valueForItem: (item: T) => string) {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    const key = valueForItem(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function stateCounts(patients: PatientLookupPatient[]) {
  const counts = patients.reduce<Record<string, number>>((acc, patient) => {
    const key = patient.serviceState || "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);
}

function PatientDemographicsOverview({
  patients,
}: {
  patients: PatientLookupPatient[];
}) {
  const total = patients.length;
  const knownAge = patients.filter((patient) => ageFromDateOfBirth(patient.dateOfBirth) != null).length;
  const knownGender = patients.filter((patient) => patient.gender?.trim()).length;
  const ageRanges = countBy(patients, ageRangeForPatient);
  const genderCounts = countBy(patients, (patient) => genderLabel(patient.gender));
  const states = stateCounts(patients);

  const statCards = [
    { label: "Patients", value: total },
    { label: "Known age", value: knownAge },
    { label: "Known gender", value: knownGender },
    { label: "States", value: states.filter(([state]) => state !== "Unknown").length },
  ];

  return (
    <section
      aria-label="Patient demographics overview"
      style={{
        display: "grid",
        gap: 14,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        {statCards.map((card) => (
          <div
            key={card.label}
            style={{
              minHeight: 88,
              padding: 14,
              display: "grid",
              alignContent: "space-between",
              border: "1px solid #e5ebf5",
              borderRadius: 10,
              background: "#ffffff",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, color: "#475569", fontWeight: 800 }}>
              {card.label}
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 28, lineHeight: 1, color: "#172033", fontWeight: 900 }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ padding: 14, border: "1px solid #e5ebf5", borderRadius: 10, background: "#fff" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#172033", fontWeight: 900 }}>
            Age range
          </p>
          {ageRanges.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, display: "grid", gap: 7, listStyle: "none" }}>
              {ageRanges.map(([range, count]) => (
                <li key={range} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                  <span style={{ color: "#475569", fontWeight: 800 }}>{range}</span>
                  <strong style={{ color: "#172033" }}>{count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>No age data yet.</p>
          )}
        </div>

        <div style={{ padding: 14, border: "1px solid #e5ebf5", borderRadius: 10, background: "#fff" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#172033", fontWeight: 900 }}>
            Gender
          </p>
          {genderCounts.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, display: "grid", gap: 7, listStyle: "none" }}>
              {genderCounts.map(([gender, count]) => (
                <li key={gender} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                  <span style={{ color: "#475569", fontWeight: 800 }}>{gender}</span>
                  <strong style={{ color: "#172033" }}>{count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>No gender data yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function PatientTable({
  patients,
  allPatients,
  filterText,
  stateFilter,
  onFilterTextChange,
  onStateFilterChange,
  onOpenPatient,
}: {
  patients: PatientLookupPatient[];
  allPatients: PatientLookupPatient[];
  filterText: string;
  stateFilter: string;
  onFilterTextChange: (value: string) => void;
  onStateFilterChange: (value: string) => void;
  onOpenPatient: (patient: PatientLookupPatient) => void;
}) {
  const states = uniquePatientStates(allPatients);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <p style={{ margin: 0, color: "#64748b", fontSize: 13, fontWeight: 800 }}>
          {patients.length} of {allPatients.length} patients
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
          <input
            value={filterText}
            onChange={(event) => onFilterTextChange(event.target.value)}
            placeholder="Search table"
            aria-label="Search patient table"
            style={{
              width: 240,
              maxWidth: "100%",
              padding: "9px 11px",
              borderRadius: 8,
              border: "1px solid #dbe3ef",
              fontSize: 13,
              color: "#172033",
            }}
          />
          <select
            value={stateFilter}
            onChange={(event) => onStateFilterChange(event.target.value)}
            aria-label="Filter patients by state"
            style={{
              minWidth: 128,
              padding: "9px 11px",
              borderRadius: 8,
              border: "1px solid #dbe3ef",
              background: "#fff",
              fontSize: 13,
              color: "#172033",
            }}
          >
            <option value="">All states</option>
            {states.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>
      </div>

      {patients.length > 0 ? (
        <div style={{ overflowX: "auto", border: "1px solid #e5ebf5", borderRadius: 10, background: "#fff" }}>
          <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Patient", "Age", "Gender", "State", "Intake form", "Booking requests", "Provider appts", "Latest activity"].map((header) => (
                  <th
                    key={header}
                    scope="col"
                    style={{
                      padding: "11px 12px",
                      textAlign: "left",
                      color: "#64748b",
                      fontWeight: 900,
                      borderBottom: "1px solid #e5ebf5",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => {
                const latestUpdate = latestPatientUpdate(patient);
                return (
                  <tr
                    key={patient.userId}
                    tabIndex={0}
                    onClick={() => onOpenPatient(patient)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenPatient(patient);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                    aria-label={`Open ${patient.name} profile`}
                  >
                    <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
                      <strong style={{ display: "block", color: "#172033" }}>{patient.name}</strong>
                      <span style={{ display: "block", marginTop: 3, color: "#64748b", fontSize: 12 }}>
                        {patient.email ?? patient.userId}
                      </span>
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9", color: "#334155" }}>
                      {ageRangeForPatient(patient)}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9", color: "#334155" }}>
                      {genderLabel(patient.gender)}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9", color: "#334155", fontWeight: 800 }}>
                      {patient.serviceState ?? "Unknown"}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9", color: "#334155", textTransform: "capitalize" }}>
                      {statusLabel(patient.latestSubmission?.status)}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9", color: "#334155" }}>
                      {patient.bookings.length}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9", color: "#334155" }}>
                      {patient.appointments.length}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9", color: "#64748b" }}>
                      {latestUpdate ? formatUpdated(latestUpdate) : "No activity"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ margin: 0, padding: 18, border: "1px solid #e5ebf5", borderRadius: 10, background: "#fff", color: "#64748b", fontSize: 14 }}>
          No patients match those filters.
        </p>
      )}
    </div>
  );
}

function PatientProfile({
  patient,
  onBack,
}: {
  patient: PatientLookupPatient;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"profile" | "audit">("profile");

  const tabStyle = (active: boolean) => ({
    padding: "8px 12px",
    border: "1px solid #dbe3ef",
    borderRadius: 8,
    background: active ? "#172033" : "#fff",
    color: active ? "#fff" : "#475569",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <nav aria-label="Patient profile breadcrumb" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: 0,
            border: 0,
            background: "transparent",
            color: "#2563eb",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Patient search
        </button>
        <span style={{ color: "#94a3b8" }}>/</span>
        <span style={{ color: "#475569", fontWeight: 800 }}>{patient.name}</span>
      </nav>

      <div role="tablist" aria-label="Patient profile sections" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "profile"}
          onClick={() => setActiveTab("profile")}
          style={tabStyle(activeTab === "profile")}
        >
          Profile
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "audit"}
          onClick={() => setActiveTab("audit")}
          style={tabStyle(activeTab === "audit")}
        >
          Audit trail
        </button>
      </div>

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
        {activeTab === "profile" ? (
          <>
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

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            margin: 0,
          }}
        >
          {[
            ["Age range", ageRangeForPatient(patient)],
            ["Gender", genderLabel(patient.gender)],
            ["State", patient.serviceState ?? "Unknown"],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: 12, border: "1px solid #e5ebf5", borderRadius: 8, background: "#fff" }}>
              <dt style={{ marginBottom: 4, color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</dt>
              <dd style={{ margin: 0, color: "#172033", fontSize: 13, fontWeight: 800 }}>{value}</dd>
            </div>
          ))}
        </dl>

        {patient.bookings.length > 0 ? (
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b", fontWeight: 800 }}>
              Booking requests
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
              Provider appointments
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
          </>
        ) : (
          <AuditTrailPanel
            title="Patient audit trail"
            target={{ patientUserId: patient.userId }}
          />
        )}
      </article>
    </div>
  );
}

export function PatientLookupPanel({
  initialPatientId = null,
  initialQuery = "",
}: {
  initialPatientId?: string | null;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [stateFilter, setStateFilter] = useState("");
  const [patients, setPatients] = useState<PatientLookupPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientLookupPatient | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPatients(
    options: { selectPatientId?: string | null } = {},
  ) {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    setSelectedPatient(null);
    setPatients([]);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to search patients.");
      }

      const response = await fetchPatientLookup(session.access_token);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }
      const payload = await response.json() as PatientLookupResponse;
      const nextPatients = payload.patients ?? [];
      setPatients(nextPatients);
      if (options.selectPatientId) {
        setSelectedPatient(
          nextPatients.find((patient) => patient.userId === options.selectPatientId) ?? null,
        );
      }
    } catch (err) {
      setPatients([]);
      setError(err instanceof Error ? err.message : "Could not search patients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQuery(initialQuery);
    void loadPatients({
      selectPatientId: initialPatientId,
    });
  }, [initialPatientId, initialQuery]);

  const filteredPatients = useMemo(
    () => patients.filter((patient) => patientMatchesFilter(patient, query, stateFilter)),
    [patients, query, stateFilter],
  );

  if (selectedPatient) {
    return (
      <section style={{ margin: "0 0 28px" }} aria-labelledby="patient-profile-title">
        <h2 id="patient-profile-title" style={{ margin: "0 0 8px", fontSize: 18 }}>
          Patient profile
        </h2>
        <PatientProfile patient={selectedPatient} onBack={() => setSelectedPatient(null)} />
      </section>
    );
  }

  return (
    <section style={{ margin: "0 0 28px" }} aria-labelledby="patient-lookup-title">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 id="patient-lookup-title" style={{ margin: "8px 0 0", fontSize: 18 }}>
          Patients
        </h2>
        <button
          type="button"
          onClick={() => void loadPatients()}
          disabled={loading}
          style={{
            minHeight: 36,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid #dbe3ef",
            background: "#fff",
            color: "#172033",
            fontSize: 13,
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <PatientDemographicsOverview patients={patients} />

      <div
        aria-live="polite"
        style={{
          minHeight: 220,
          display: "grid",
          gap: 12,
          padding: 16,
          border: "1px solid #e5ebf5",
          borderRadius: 10,
          background: "#f8fafc",
        }}
      >
        {!searched && !loading ? (
          <p style={{ margin: 0, alignSelf: "center", justifySelf: "center", fontSize: 14, color: "#64748b" }}>
            Loading patients...
          </p>
        ) : null}

        {loading ? (
          <p style={{ margin: 0, alignSelf: "center", justifySelf: "center", fontSize: 14, color: "#64748b" }}>
            Loading patients...
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            style={{ margin: 0, alignSelf: "center", justifySelf: "center", color: "#b91c1c", fontSize: 14 }}
          >
            {error}
          </p>
        ) : null}

        {searched && !loading && !error && patients.length === 0 ? (
          <p style={{ margin: 0, alignSelf: "center", justifySelf: "center", fontSize: 14, color: "#64748b" }}>
            No patients found.
          </p>
        ) : null}

        {!loading && !error && patients.length > 0 ? (
          <PatientTable
            patients={filteredPatients}
            allPatients={patients}
            filterText={query}
            stateFilter={stateFilter}
            onFilterTextChange={setQuery}
            onStateFilterChange={setStateFilter}
            onOpenPatient={setSelectedPatient}
          />
        ) : null}
      </div>
    </section>
  );
}
