import { describe, expect, it } from "vitest";
import {
  canReconcileStripeTransaction,
  formatTransactionAmount,
  stripeDashboardUrl,
  transactionPatientLabel,
  transactionStatusView,
  transactionWebhookStatusView,
} from "./transactions";

const row = {
  id: "booking-1",
  userId: "user-1",
  patientName: "Pat Patient",
  patientEmail: "pat@example.com",
  amountCents: 19900,
  currency: "usd",
  paymentStatus: "paid",
  bookingStatus: "booked",
  serviceState: "SC",
  stripeCheckoutSessionId: "cs_test_123",
  stripePaymentIntentId: "pi_test_123",
  paidAt: "2026-05-01T15:00:00.000Z",
  createdAt: "2026-05-01T14:00:00.000Z",
  updatedAt: "2026-05-01T15:05:00.000Z",
};

describe("transaction dashboard helpers", () => {
  it("formats patient and amount labels", () => {
    expect(transactionPatientLabel(row)).toBe("Pat Patient · pat@example.com");
    expect(formatTransactionAmount(row)).toBe("$199.00");
    expect(formatTransactionAmount({ ...row, amountCents: null })).toBe("Not recorded");
  });

  it("maps payment status to compact badges", () => {
    expect(transactionStatusView("paid")).toMatchObject({ label: "Paid" });
    expect(transactionStatusView("pending")).toMatchObject({ label: "Pending" });
    expect(transactionStatusView(null)).toMatchObject({ label: "Unknown" });
  });

  it("shows whether Stripe checkout completion has reached the app", () => {
    expect(transactionWebhookStatusView(row)).toMatchObject({ label: "Received" });
    expect(transactionWebhookStatusView({
      ...row,
      paymentStatus: "pending",
      paidAt: null,
    })).toMatchObject({ label: "Not Received" });
    expect(transactionWebhookStatusView({
      ...row,
      paymentStatus: "unpaid",
      stripeCheckoutSessionId: null,
      paidAt: null,
    })).toMatchObject({ label: "Not Expected" });
  });

  it("allows reconciliation only for pending rows with a Stripe checkout session", () => {
    expect(canReconcileStripeTransaction({
      ...row,
      paymentStatus: "pending",
      paidAt: null,
    })).toBe(true);
    expect(canReconcileStripeTransaction(row)).toBe(false);
    expect(canReconcileStripeTransaction({
      ...row,
      paymentStatus: "pending",
      stripeCheckoutSessionId: null,
      paidAt: null,
    })).toBe(false);
  });

  it("builds Stripe dashboard links from checkout sessions first", () => {
    expect(stripeDashboardUrl(row)).toBe(
      "https://dashboard.stripe.com/test/checkout/sessions/cs_test_123",
    );
    expect(stripeDashboardUrl({
      ...row,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: "pi_test_123",
    })).toBe("https://dashboard.stripe.com/test/payments/pi_test_123");
    expect(stripeDashboardUrl({
      ...row,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
    })).toBeNull();
  });
});
