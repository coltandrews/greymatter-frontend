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
      lead: "Your medication request status is not available from this link.",
      summary: "Return to your portal to check the latest request information.",
      hint: "If payment went through, we can still reconcile the request from Stripe and Ola records.",
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
      lead: "Your payment was received and your medication request was sent for provider review.",
      summary,
      hint: "Return to your patient portal any time to refresh medication status.",
    };
  }

  if (bookingIntent.booking_status === "action_required") {
    return {
      tone: "action",
      icon: "!",
      title: "Next steps ready",
      lead: "Your payment was received and provider next steps are ready.",
      summary,
      hint: "Review the next steps before continuing outside Greymatter.",
    };
  }

  if (bookingIntent.booking_status === "needs_review") {
    return {
      tone: "review",
      icon: "!",
      title: "Payment received",
      lead: "We are reviewing your medication request.",
      summary,
      hint: "Your payment succeeded, but automatic provider handoff did not finish. We will follow up with next steps.",
    };
  }

  return {
    tone: "pending",
    icon: "...",
    title: "Payment received",
    lead: "We are sending your medication request for provider review.",
    summary,
    hint: "This can take a moment after checkout. Refresh this page or return to your portal for the latest status.",
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
