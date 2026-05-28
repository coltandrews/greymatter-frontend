export type HubBookingIntentStatusInput = {
  booking_status: string | null;
  payment_status: string | null;
  ola_status: string | null;
};

export type HubBookingIntentStatusView = {
  label: string;
  subtitle: string;
  tone: "confirmed" | "pending" | "action" | "review" | "cancelled";
};

export function hubBookingIntentStatusView(
  input: HubBookingIntentStatusInput,
): HubBookingIntentStatusView {
  if (
    input.booking_status === "booked" &&
    input.payment_status === "paid" &&
    input.ola_status === "booked"
  ) {
    return {
      label: "Confirmed",
      subtitle: "Provider review received. Watch for medication and shipment updates.",
      tone: "confirmed",
    };
  }

  if (input.booking_status === "action_required") {
    return {
      label: "Next steps",
      subtitle: "Provider next steps are ready. If you are not eligible, your payment will be refunded.",
      tone: "action",
    };
  }

  if (input.booking_status === "needs_review") {
    return {
      label: "Provider review",
      subtitle: "Payment received. The provider network is reviewing your request. If you are not eligible, your payment will be refunded.",
      tone: "review",
    };
  }

  if (input.booking_status === "cancelled") {
    return {
      label: "Cancelled",
      subtitle: "This medication request was cancelled.",
      tone: "cancelled",
    };
  }

  if (input.payment_status === "paid") {
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
