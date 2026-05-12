export type BookingIntentReturnRow = {
  id: string | null;
  booking_status: string | null;
  payment_status: string | null;
  ola_status: string | null;
  ola_redirect_url: string | null;
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
      lead: "We could not load this request status.",
      summary: "Check your portal for the latest update.",
      hint: "If payment went through, support can reconcile the request.",
    };
  }

  const summary = "You will receive SMS and email instructions from our care partner.";

  if (
    bookingIntent.booking_status === "booked" &&
    bookingIntent.payment_status === "paid" &&
    bookingIntent.ola_status === "booked"
  ) {
    return {
      tone: "success",
      icon: "✓",
      title: "Request submitted",
      lead: "Your payment was received and your request was sent for provider review.",
      summary,
      hint: "You can track updates from your portal.",
    };
  }

  if (bookingIntent.booking_status === "action_required") {
    return {
      tone: "action",
      icon: "!",
      title: "Next steps ready",
      lead: "Your payment was received and your provider next steps are ready.",
      summary,
      hint: "Review the next steps when you are ready.",
    };
  }

  if (bookingIntent.booking_status === "needs_review") {
    return {
      tone: "review",
      icon: "...",
      title: "Under review",
      lead: "We received your payment. Your request is being reviewed.",
      summary,
      hint: "We will follow up if anything else is needed.",
    };
  }

  return {
    tone: "pending",
    icon: "...",
    title: "Processing request",
    lead: "We received your payment and are sending your request for provider review.",
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
