"use client";

import {
  fetchTransactionReceipt,
  fetchTransactions,
  type TransactionRow,
  type TransactionsResponse,
} from "@/lib/api/admin";
import { reconcileBookingIntentStripe } from "@/lib/api/bookingIntents";
import {
  canReconcileStripeTransaction,
  formatTransactionAmount,
  stripeDashboardUrl,
  transactionPatientLabel,
  transactionReceiptFileName,
  transactionStatusView,
  transactionWebhookStatusView,
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
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [rowMessageById, setRowMessageById] = useState<Record<string, string>>({});

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

  async function reconcileStripe(row: TransactionRow) {
    setOpenActionMenuId(null);
    setReconcilingId(row.id);
    setRowMessageById((messages) => ({ ...messages, [row.id]: "" }));
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to reconcile Stripe.");
      }

      const response = await reconcileBookingIntentStripe(session.access_token, row.id);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }

      setRowMessageById((messages) => ({
        ...messages,
        [row.id]: "Stripe payment reconciled.",
      }));
      await loadTransactions();
    } catch (err) {
      setRowMessageById((messages) => ({
        ...messages,
        [row.id]: err instanceof Error ? err.message : "Could not reconcile Stripe.",
      }));
    } finally {
      setReconcilingId(null);
    }
  }

  async function downloadReceipt(row: TransactionRow) {
    setOpenActionMenuId(null);
    setDownloadingReceiptId(row.id);
    setRowMessageById((messages) => ({ ...messages, [row.id]: "" }));
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to download receipts.");
      }

      const response = await fetchTransactionReceipt(session.access_token, row.id);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = transactionReceiptFileName(row);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setRowMessageById((messages) => ({
        ...messages,
        [row.id]: "Receipt downloaded.",
      }));
    } catch (err) {
      setRowMessageById((messages) => ({
        ...messages,
        [row.id]: err instanceof Error ? err.message : "Could not download receipt.",
      }));
    } finally {
      setDownloadingReceiptId(null);
    }
  }

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
                <th scope="col" className={styles.actionColumn}>Actions</th>
                <th scope="col">Patient</th>
                <th scope="col">Status</th>
                <th scope="col">Amount</th>
                <th scope="col">Paid</th>
                <th scope="col">Webhook</th>
                <th scope="col">Booking</th>
                <th scope="col">Stripe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = transactionStatusView(row.paymentStatus);
                const webhookStatus = transactionWebhookStatusView(row);
                const stripeUrl = stripeDashboardUrl(row);
                const canReconcile = canReconcileStripeTransaction(row);
                const rowMessage = rowMessageById[row.id];

                return (
                  <tr key={row.id}>
                    <td className={styles.actionCell}>
                      <div className={styles.contextMenu}>
                        <button
                          type="button"
                          className={styles.contextMenuButton}
                          aria-haspopup="menu"
                          aria-expanded={openActionMenuId === row.id}
                          aria-label={`Open actions for ${transactionPatientLabel(row)}`}
                          onClick={() => {
                            setOpenActionMenuId((current) => current === row.id ? null : row.id);
                          }}
                        >
                          ...
                        </button>
                        {openActionMenuId === row.id ? (
                          <div className={styles.contextMenuPanel} role="menu">
                            {stripeUrl ? (
                              <a
                                role="menuitem"
                                className={styles.contextMenuItem}
                                href={stripeUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                }}
                              >
                                View In Stripe
                              </a>
                            ) : null}
                            <button
                              type="button"
                              role="menuitem"
                              className={styles.contextMenuItem}
                              onClick={() => {
                                void downloadReceipt(row);
                              }}
                              disabled={downloadingReceiptId === row.id}
                            >
                              {downloadingReceiptId === row.id ? "Downloading..." : "Print Receipt"}
                            </button>
                            {canReconcile ? (
                              <button
                                type="button"
                                role="menuitem"
                                className={styles.contextMenuItem}
                                onClick={() => {
                                  void reconcileStripe(row);
                                }}
                                disabled={reconcilingId === row.id}
                              >
                                {reconcilingId === row.id ? "Checking..." : "Reconcile"}
                              </button>
                            ) : null}
                            {!stripeUrl && !canReconcile ? (
                              <span className={styles.contextMenuEmpty}>No Stripe action</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
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
                      <span
                        className={styles.statusBadge}
                        style={{ background: webhookStatus.background, color: webhookStatus.color }}
                      >
                        {webhookStatus.label}
                      </span>
                    </td>
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
                      {rowMessage ? (
                        <span
                          className={
                            rowMessage.includes("reconciled") || rowMessage.includes("downloaded")
                              ? styles.actionMessage
                              : styles.actionError
                          }
                        >
                          {rowMessage}
                        </span>
                      ) : null}
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
