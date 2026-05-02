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

export function transactionStatusView(status: string | null): TransactionStatusView {
  switch (status) {
    case "paid":
      return { label: "Paid", color: "#166534", background: "#dcfce7" };
    case "pending":
      return { label: "Pending", color: "#92400e", background: "#fef3c7" };
    case "failed":
      return { label: "Failed", color: "#b91c1c", background: "#fee2e2" };
    case "refunded":
      return { label: "Refunded", color: "#475569", background: "#f1f5f9" };
    default:
      return { label: status || "Unknown", color: "#475569", background: "#f1f5f9" };
  }
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
