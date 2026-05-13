import type { TransactionRow } from "@/lib/api/admin";

export type TransactionStatusView = {
  label: string;
  color: string;
  background: string;
};

export function transactionPatientLabel(row: TransactionRow): string {
  return row.patientEmail ? `${row.patientName} · ${row.patientEmail}` : row.patientName;
}

export function formatTransactionAmount(row: TransactionRow): string {
  if (typeof row.amountCents !== "number") {
    return "Not recorded";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: row.currency || "usd",
  }).format(row.amountCents / 100);
}

export function transactionReceiptFileName(row: TransactionRow): string {
  const safeId = row.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `greymatter-receipt-${safeId}.pdf`;
}

export function transactionStatusView(status: string | null): TransactionStatusView {
  switch (status) {
    case "paid":
      return { label: "Paid", color: "#86efac", background: "rgba(22, 163, 74, 0.16)" };
    case "pending":
      return { label: "Pending", color: "#fdba74", background: "rgba(180, 83, 9, 0.16)" };
    case "failed":
      return { label: "Failed", color: "#fca5a5", background: "rgba(127, 29, 29, 0.24)" };
    case "refunded":
      return { label: "Refunded", color: "#b8b8b8", background: "#242424" };
    default:
      return { label: status || "Unknown", color: "#b8b8b8", background: "#242424" };
  }
}

export function transactionWebhookStatusView(row: TransactionRow): TransactionStatusView {
  if (row.paymentStatus === "paid" && row.paidAt) {
    return { label: "Received", color: "#86efac", background: "rgba(22, 163, 74, 0.16)" };
  }

  if (row.paymentStatus === "pending" && row.stripeCheckoutSessionId?.trim()) {
    return { label: "Not Received", color: "#fdba74", background: "rgba(180, 83, 9, 0.16)" };
  }

  return { label: "Not Expected", color: "#b8b8b8", background: "#242424" };
}

export function canReconcileStripeTransaction(row: TransactionRow): boolean {
  return row.paymentStatus === "pending" && Boolean(row.stripeCheckoutSessionId?.trim());
}

export function stripeDashboardUrl(row: TransactionRow): string | null {
  if (row.stripeCheckoutSessionId?.trim()) {
    const sessionId = row.stripeCheckoutSessionId.trim();
    const mode = sessionId.startsWith("cs_test_") ? "/test" : "";
    return `https://dashboard.stripe.com${mode}/checkout/sessions/${encodeURIComponent(sessionId)}`;
  }

  if (row.stripePaymentIntentId?.trim()) {
    const paymentIntentId = row.stripePaymentIntentId.trim();
    const mode = paymentIntentId.includes("_test_") ? "/test" : "";
    return `https://dashboard.stripe.com${mode}/payments/${encodeURIComponent(paymentIntentId)}`;
  }

  return null;
}
