export type BookingIntentReturnRow = {
  id: string | null;
  booking_status: string | null;
  payment_status: string | null;
  ola_status: string | null;
  ola_redirect_url: string | null;
  intake_data?: unknown;
  selected_slot: unknown;
};

export type CheckoutReturnView = {
  tone: "success" | "pending" | "action" | "review";
  icon: string;
  title: string;
  lead: string;
  summary: string;
  hint: string;
};

export type CheckoutReturnAction = {
  href: string;
  label: string;
} | null;

export function checkoutReturnView(
  bookingIntent: BookingIntentReturnRow | null,
): CheckoutReturnView {
  if (!bookingIntent) {
    return {
      tone: "review",
      icon: "!",
      title: "We could not find that checkout",
      lead: "Check your portal for the latest status.",
      summary: "Check your portal for the latest update.",
      hint: "If payment went through, support can reconcile the request.",
    };
  }

  const summary = "";

  if (
    bookingIntent.booking_status === "booked" &&
    bookingIntent.payment_status === "paid" &&
    bookingIntent.ola_status === "booked"
  ) {
    return {
      tone: "success",
      icon: "✓",
      title: "Request submitted",
      lead: "Your request was sent for review.",
      summary,
      hint: "You can track updates from your portal.",
    };
  }

  if (bookingIntent.booking_status === "action_required") {
    return {
      tone: "action",
      icon: "!",
      title: "Next steps ready",
      lead: "Your next steps are ready.",
      summary,
      hint: "Review the next steps when you are ready.",
    };
  }

  if (bookingIntent.booking_status === "needs_review") {
    return {
      tone: "review",
      icon: "...",
      title: "Provider review",
      lead: "The provider network is reviewing your request.",
      summary,
      hint: "If the provider determines you are not eligible, your payment will be refunded.",
    };
  }

  return {
    tone: "pending",
    icon: "...",
    title: "Processing request",
    lead: "Sending your request for review.",
    summary,
    hint: "This can take a moment.",
  };
}

export function checkoutReturnAction(
  bookingIntent: BookingIntentReturnRow | null,
): CheckoutReturnAction {
  if (
    bookingIntent?.booking_status !== "action_required" ||
    !bookingIntent.id ||
    !bookingIntent.ola_redirect_url
  ) {
    return null;
  }

  return {
    href: `/ola-handoff/booking/${encodeURIComponent(bookingIntent.id)}`,
    label: "Review next steps",
  };
}

export function shouldPollCheckoutReturn(
  bookingIntent: BookingIntentReturnRow | null,
): boolean {
  if (!bookingIntent) {
    return false;
  }
  return !(
    (bookingIntent.booking_status === "booked" &&
      bookingIntent.payment_status === "paid" &&
      bookingIntent.ola_status === "booked") ||
    bookingIntent.booking_status === "action_required" ||
    bookingIntent.booking_status === "needs_review"
  );
}
