import { patientProviderIssueMessage } from "./checkoutReturn";
import { bookingLifecycleState } from "./bookingLifecycle";

export type HubBookingIntentStatusInput = {
  booking_status: string | null;
  payment_status: string | null;
  ola_status: string | null;
  failure_reason?: string | null;
};

export type HubBookingIntentStatusView = {
  label: string;
  subtitle: string;
  tone: "confirmed" | "pending" | "action" | "review" | "failed" | "cancelled";
};

export function hubBookingIntentStatusView(
  input: HubBookingIntentStatusInput,
): HubBookingIntentStatusView {
  const lifecycle = bookingLifecycleState({
    bookingStatus: input.booking_status,
    paymentStatus: input.payment_status,
    olaStatus: input.ola_status,
    failureReason: input.failure_reason,
  });
  const failureReason = input.failure_reason?.trim();

  if (lifecycle.stage === "provider_handoff_failed") {
    const issue = patientProviderIssueMessage(failureReason);
    return {
      label: "Needs attention",
      subtitle: `Payment received, but we could not send this request for provider review. ${issue}`,
      tone: "failed",
    };
  }

  if (lifecycle.stage === "provider_confirmed") {
    return {
      label: "Confirmed",
      subtitle: "Provider review received. Watch for medication and shipment updates.",
      tone: "confirmed",
    };
  }

  if (lifecycle.stage === "provider_next_steps") {
    return {
      label: "Next steps",
      subtitle: "Provider next steps are ready. If you are not eligible, your payment will be refunded.",
      tone: "action",
    };
  }

  if (lifecycle.stage === "provider_review") {
    return {
      label: "Provider review",
      subtitle: "Payment received. The provider network is reviewing your request. If you are not eligible, your payment will be refunded.",
      tone: "review",
    };
  }

  if (lifecycle.stage === "cancelled") {
    return {
      label: "Cancelled",
      subtitle: "This medication request was cancelled.",
      tone: "cancelled",
    };
  }

  if (lifecycle.stage === "provider_handoff") {
    return {
      label: "Processing",
      subtitle: "Payment received. Provider review is in progress. If you are not eligible, your payment will be refunded.",
      tone: "pending",
    };
  }

  return {
    label: "Payment Pending",
    subtitle: "Checkout is not complete. This medication request is not submitted yet.",
    tone: "pending",
  };
}
