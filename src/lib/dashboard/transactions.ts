import type { TransactionRow } from "@/lib/api/admin";
import { treatmentByKey } from "@/lib/treatments";

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

export function transactionTreatmentLabel(row: TransactionRow): string {
  const treatment = treatmentByKey(row.treatmentKey);
  const label = treatment?.name ?? row.treatmentKey?.trim() ?? "Treatment not selected";
  return row.treatmentAnswerCount > 0
    ? `${label} · ${row.treatmentAnswerCount} med Q&A`
    : label;
}

export function transactionRequestStatusLabel(row: TransactionRow): string {
  if (row.bookingStatus === "needs_review") {
    return "Under review";
  }
  if (row.bookingStatus === "action_required") {
    return "Action required";
  }
  if (row.bookingStatus === "booked") {
    return "Provider handoff complete";
  }
  return row.bookingStatus?.replace(/_/g, " ") || "Unknown";
}

export function transactionReceiptFileName(row: TransactionRow): string {
  const safeId = row.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `greymatter-receipt-${safeId}.pdf`;
}

export function transactionStatusView(status: string | null): TransactionStatusView {
  switch (status) {
    case "paid":
      return { label: "Paid", color: "#171717", background: "rgba(23, 23, 23, 0.16)" };
    case "pending":
      return { label: "Pending", color: "#242424", background: "rgba(23, 23, 23, 0.16)" };
    case "failed":
      return { label: "Failed", color: "var(--gm-error)", background: "rgba(23, 23, 23, 0.24)" };
    case "refunded":
      return { label: "Refunded", color: "var(--gm-muted)", background: "var(--gm-border)" };
    default:
      return { label: status || "Unknown", color: "var(--gm-muted)", background: "var(--gm-border)" };
  }
}

export function transactionWebhookStatusView(row: TransactionRow): TransactionStatusView {
  if (row.paymentStatus === "paid" && row.paidAt) {
    return { label: "Received", color: "#171717", background: "rgba(23, 23, 23, 0.16)" };
  }

  if (row.paymentStatus === "pending" && row.stripeCheckoutSessionId?.trim()) {
    return { label: "Not Received", color: "#242424", background: "rgba(23, 23, 23, 0.16)" };
  }

  return { label: "Not Expected", color: "var(--gm-muted)", background: "var(--gm-border)" };
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
