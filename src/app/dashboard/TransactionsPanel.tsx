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
} from "@/lib/dashboard/transactions";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";

type ActionMenuState = {
  id: string;
  top: number;
  left: number;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
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

function patientProfileHref(row: TransactionRow): string {
  const search = new URLSearchParams({
    patient: row.userId,
    q: row.patientEmail ?? row.userId,
  });
  return `/dashboard/patients?${search.toString()}`;
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
  const [openActionMenu, setOpenActionMenu] = useState<ActionMenuState | null>(null);
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
    setOpenActionMenu(null);
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
    setOpenActionMenu(null);
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

  function toggleActionMenu(row: TransactionRow, button: HTMLButtonElement) {
    setOpenActionMenu((current) => {
      if (current?.id === row.id) {
        return null;
      }

      const rect = button.getBoundingClientRect();
      return {
        id: row.id,
        top: rect.bottom + 6,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 190)),
      };
    });
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
                <th scope="col" className={styles.paidColumn}>Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = transactionStatusView(row.paymentStatus);
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
                          aria-expanded={openActionMenu?.id === row.id}
                          aria-label={`Open actions for ${transactionPatientLabel(row)}`}
                          onClick={(event) => {
                            toggleActionMenu(row, event.currentTarget);
                          }}
                        >
                          ...
                        </button>
                        {openActionMenu?.id === row.id ? (
                          <div
                            className={styles.contextMenuPanel}
                            role="menu"
                            style={{
                              top: openActionMenu.top,
                              left: openActionMenu.left,
                            }}
                          >
                            {stripeUrl ? (
                              <a
                                role="menuitem"
                                className={styles.contextMenuItem}
                                href={stripeUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => {
                                  setOpenActionMenu(null);
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
                        <Link className={styles.patientLink} href={patientProfileHref(row)}>
                          {transactionPatientLabel(row)}
                        </Link>
                      </strong>
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
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={{ background: status.background, color: status.color }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td>{formatTransactionAmount(row)}</td>
                    <td className={styles.paidCell}>{formatDate(row.paidAt)}</td>
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
