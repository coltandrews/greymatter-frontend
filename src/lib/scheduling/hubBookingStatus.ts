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
      subtitle: "Initial semaglutide consultation",
      tone: "confirmed",
    };
  }

  if (input.booking_status === "action_required") {
    return {
      label: "Next steps",
      subtitle: "Provider booking is ready. Review the next steps.",
      tone: "action",
    };
  }

  if (input.booking_status === "needs_review") {
    return {
      label: "Needs review",
      subtitle: "Payment received. We are confirming provider booking.",
      tone: "review",
    };
  }

  if (input.booking_status === "cancelled") {
    return {
      label: "Cancelled",
      subtitle: "This appointment request was cancelled.",
      tone: "cancelled",
    };
  }

  if (input.payment_status === "paid") {
    return {
      label: "Processing",
      subtitle: "Payment received. Provider booking is in progress.",
      tone: "pending",
    };
  }

  return {
    label: "Payment Pending",
    subtitle: "Checkout is not complete. This appointment is not booked yet.",
    tone: "pending",
  };
}
