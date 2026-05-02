"use client";

import {
  fetchTransactions,
  type TransactionRow,
  type TransactionsResponse,
} from "@/lib/api/admin";
import {
  formatTransactionAmount,
  stripeDashboardUrl,
  transactionPatientLabel,
  transactionStatusView,
} from "@/lib/dashboard/transactions";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";

function formatDate(value: string | null): string {
  if (!value) {
    return "Not paid";
  }
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
    : `Transactions failed (${res.status}).`;
}

export function TransactionsPanel() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTransactions() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to load transactions.");
      }

      const response = await fetchTransactions(session.access_token, 100);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }

      const payload = await response.json() as TransactionsResponse;
      setRows(payload.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load transactions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTransactions();
  }, []);

  return (
    <section className={styles.workspaceCard} aria-labelledby="transactions-title">
      <div className={styles.workspaceHeader}>
        <div>
          <h2 id="transactions-title" className={styles.workspaceTitle}>
            Transactions
          </h2>
          <p className={styles.compactText}>
            {loading ? "Loading patient transactions..." : `${rows.length} transaction${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          className={styles.smallAction}
          onClick={() => {
            void loadTransactions();
          }}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <p role="alert" className={styles.inlineError}>
          {error}
        </p>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className={styles.emptyText}>No patient transactions yet.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Status</th>
                <th scope="col">Amount</th>
                <th scope="col">Paid</th>
                <th scope="col">Booking</th>
                <th scope="col">Stripe</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = transactionStatusView(row.paymentStatus);
                const stripeUrl = stripeDashboardUrl(row);

                return (
                  <tr key={row.id}>
                    <td>
                      <strong className={styles.tableStrong}>
                        {transactionPatientLabel(row)}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={{ background: status.background, color: status.color }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td>{formatTransactionAmount(row)}</td>
                    <td>{formatDate(row.paidAt)}</td>
                    <td>
                      <span className={styles.monoCell} title={row.id}>
                        {row.id}
                      </span>
                    </td>
                    <td>
                      <span
                        className={styles.monoCell}
                        title={row.stripeCheckoutSessionId ?? row.stripePaymentIntentId ?? "No Stripe ID"}
                      >
                        {row.stripeCheckoutSessionId ?? row.stripePaymentIntentId ?? "No Stripe ID"}
                      </span>
                    </td>
                    <td>
                      {stripeUrl ? (
                        <a
                          className={styles.smallAction}
                          href={stripeUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View In Stripe
                        </a>
                      ) : (
                        <span className={styles.emptyText}>Not available</span>
                      )}
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
