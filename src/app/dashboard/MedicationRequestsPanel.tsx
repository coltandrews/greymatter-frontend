"use client";

import {
  fetchBookingQueue,
  type BookingQueueResponse,
  type BookingQueueRow,
} from "@/lib/api/admin";
import { bookingQueueReference, bookingQueueTreatmentLabel } from "@/lib/dashboard/bookingQueue";
import {
  medicationRequestAgeLabel,
  medicationRequestStatusView,
  medicationRequestToneStyles,
} from "@/lib/dashboard/medicationRequests";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./dashboard.module.css";

type FilterState = {
  query: string;
  status: string;
  treatment: string;
  payment: string;
  state: string;
  attentionOnly: boolean;
};

const defaultFilters: FilterState = {
  query: "",
  status: "",
  treatment: "",
  payment: "",
  state: "",
  attentionOnly: false,
};

function readBackendMessage(res: Response): Promise<string> {
  return res.json()
    .catch(() => null)
    .then((body: { message?: unknown } | null) =>
      typeof body?.message === "string" && body.message.trim()
        ? body.message
        : `Medication requests failed (${res.status}).`,
    );
}

function formatPayment(value: string | null) {
  return value?.replace(/_/g, " ") || "Unknown";
}

function idLabel(row: BookingQueueRow) {
  if (row.idDocumentStatus.sentToOla) {
    return "Sent";
  }
  if (row.idDocumentStatus.complete) {
    return "Uploaded";
  }
  if (row.idDocumentStatus.frontUploaded || row.idDocumentStatus.backUploaded) {
    return "Partial";
  }
  return "Missing";
}

function attentionReasons(row: BookingQueueRow) {
  const status = medicationRequestStatusView({
    bookingStatus: row.bookingStatus,
    paymentStatus: row.paymentStatus,
    olaStatus: row.olaStatus,
    failureReason: row.failureReason,
    hasNextSteps: row.hasNextSteps,
  });
  const reasons: string[] = [];
  if (status.key === "payment_failed") {
    reasons.push("Payment failed");
  }
  if (status.key === "needs_attention") {
    reasons.push("Provider send failed");
  }
  if (status.submitted && !row.idDocumentStatus.complete) {
    reasons.push("ID");
  }
  if (status.submitted && !row.shippingComplete) {
    reasons.push("Shipping");
  }
  return reasons;
}

function treatmentValue(row: BookingQueueRow) {
  return row.treatmentKey || "unknown";
}

function searchable(row: BookingQueueRow) {
  return [
    row.id,
    row.userId,
    row.patientName,
    row.patientEmail,
    row.phoneLast4,
    bookingQueueTreatmentLabel(row),
    row.serviceState,
    bookingQueueReference(row),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function MedicationRequestsPanel() {
  const [rows, setRows] = useState<BookingQueueRow[]>([]);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to load medication requests.");
      }
      const response = await fetchBookingQueue(session.access_token, 200);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }
      const payload = (await response.json()) as BookingQueueResponse;
      setRows(payload.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load medication requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  const options = useMemo(() => {
    const statuses = new Map<string, string>();
    const treatments = new Map<string, string>();
    const payments = new Set<string>();
    const states = new Set<string>();

    for (const row of rows) {
      const status = medicationRequestStatusView({
        bookingStatus: row.bookingStatus,
        paymentStatus: row.paymentStatus,
        olaStatus: row.olaStatus,
        failureReason: row.failureReason,
        hasNextSteps: row.hasNextSteps,
      });
      statuses.set(status.key, status.label);
      treatments.set(treatmentValue(row), bookingQueueTreatmentLabel(row).replace(/ · \d+ med Q&A$/, ""));
      if (row.paymentStatus) {
        payments.add(row.paymentStatus);
      }
      if (row.serviceState) {
        states.add(row.serviceState);
      }
    }

    return {
      statuses: Array.from(statuses.entries()).sort((a, b) => a[1].localeCompare(b[1])),
      treatments: Array.from(treatments.entries()).sort((a, b) => a[1].localeCompare(b[1])),
      payments: Array.from(payments).sort(),
      states: Array.from(states).sort(),
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return rows.filter((row) => {
      const status = medicationRequestStatusView({
        bookingStatus: row.bookingStatus,
        paymentStatus: row.paymentStatus,
        olaStatus: row.olaStatus,
        failureReason: row.failureReason,
        hasNextSteps: row.hasNextSteps,
      });
      if (filters.status && status.key !== filters.status) {
        return false;
      }
      if (filters.treatment && treatmentValue(row) !== filters.treatment) {
        return false;
      }
      if (filters.payment && row.paymentStatus !== filters.payment) {
        return false;
      }
      if (filters.state && row.serviceState !== filters.state) {
        return false;
      }
      if (filters.attentionOnly && attentionReasons(row).length === 0) {
        return false;
      }
      return !query || searchable(row).includes(query);
    });
  }, [filters, rows]);

  return (
    <section aria-labelledby="medication-requests-title">
      <div className={styles.workspaceHeader}>
        <div>
          <h2 id="medication-requests-title" className={styles.workspaceTitle}>
            Medication Requests
          </h2>
          <p className={styles.compactText}>
            {loading ? "Loading requests..." : `${visibleRows.length} of ${rows.length} requests`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRows()}
          disabled={loading}
          className={styles.smallAction}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className={styles.requestFilters}>
        <input
          className={styles.requestSearch}
          value={filters.query}
          onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
          placeholder="Search patient, email, phone, request ID"
          aria-label="Search medication requests"
        />
        <select
          className={styles.requestSelect}
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          aria-label="Filter by request status"
        >
          <option value="">All statuses</option>
          {options.statuses.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          className={styles.requestSelect}
          value={filters.treatment}
          onChange={(event) => setFilters((current) => ({ ...current, treatment: event.target.value }))}
          aria-label="Filter by treatment"
        >
          <option value="">All treatments</option>
          {options.treatments.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          className={styles.requestSelect}
          value={filters.payment}
          onChange={(event) => setFilters((current) => ({ ...current, payment: event.target.value }))}
          aria-label="Filter by payment status"
        >
          <option value="">All payments</option>
          {options.payments.map((value) => (
            <option key={value} value={value}>{formatPayment(value)}</option>
          ))}
        </select>
        <select
          className={styles.requestSelect}
          value={filters.state}
          onChange={(event) => setFilters((current) => ({ ...current, state: event.target.value }))}
          aria-label="Filter by state"
        >
          <option value="">All states</option>
          {options.states.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <label className={styles.requestToggle}>
          <input
            type="checkbox"
            checked={filters.attentionOnly}
            onChange={(event) =>
              setFilters((current) => ({ ...current, attentionOnly: event.target.checked }))
            }
          />
          Exceptions only
        </label>
      </div>

      {error ? (
        <p role="alert" className={styles.inlineError}>
          {error}
        </p>
      ) : null}

      {!error && !loading && visibleRows.length === 0 ? (
        <p className={styles.emptyText}>No medication requests match those filters.</p>
      ) : null}

      {visibleRows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={`${styles.adminTable} ${styles.requestsTable}`}>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Treatment</th>
                <th>Status</th>
                <th>Payment</th>
                <th>ID</th>
                <th>Shipping</th>
                <th>State</th>
                <th>Updated</th>
                <th>Reference</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const status = medicationRequestStatusView({
                  bookingStatus: row.bookingStatus,
                  paymentStatus: row.paymentStatus,
                  olaStatus: row.olaStatus,
                  failureReason: row.failureReason,
                  hasNextSteps: row.hasNextSteps,
                });
                const tone = medicationRequestToneStyles[status.tone];
                const reasons = attentionReasons(row);
                const href = `/dashboard/appointments/${encodeURIComponent(row.id)}`;
                return (
                  <tr key={row.id}>
                    <td>
                      <Link href={href} className={styles.patientLink}>
                        <strong className={styles.tableStrong}>{row.patientName}</strong>
                      </Link>
                      <span className={styles.tableMeta}>
                        {row.patientEmail ?? "No email"}
                        {row.phoneLast4 ? ` · SMS ${row.phoneLast4}` : ""}
                      </span>
                    </td>
                    <td>
                      <strong className={styles.tableStrong}>{bookingQueueTreatmentLabel(row)}</strong>
                      <span className={styles.tableMeta}>
                        {row.treatmentAnswerCount} medication answer{row.treatmentAnswerCount === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={{ background: tone.background, color: tone.color }}
                      >
                        {status.label}
                      </span>
                      {reasons.length > 0 ? (
                        <span className={styles.tableMeta}>{reasons.join(" · ")}</span>
                      ) : null}
                    </td>
                    <td>{formatPayment(row.paymentStatus)}</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          row.idDocumentStatus.complete
                            ? styles.overviewBadgeOk
                            : styles.overviewBadgeWarning
                        }`}
                      >
                        {idLabel(row)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.tableStrong}>
                        {row.shippingComplete ? "Complete" : "Missing"}
                      </span>
                      <span className={styles.tableMeta}>{row.shippingSummary}</span>
                    </td>
                    <td>{row.serviceState ?? "Unknown"}</td>
                    <td>{medicationRequestAgeLabel(row.updatedAt)}</td>
                    <td className={styles.monoCell} title={bookingQueueReference(row)}>
                      {bookingQueueReference(row)}
                    </td>
                    <td>
                      <Link href={href} className={styles.smallAction}>
                        Open
                      </Link>
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
