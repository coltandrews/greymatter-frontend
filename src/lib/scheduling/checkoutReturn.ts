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

function selectedSlotSummary(selectedSlot: unknown): string {
  if (!selectedSlot || typeof selectedSlot !== "object") {
    return "We are checking your appointment details.";
  }

  const slot = selectedSlot as Record<string, unknown>;
  const start = typeof slot.start === "string" ? slot.start : "";
  const providerName =
    typeof slot.providerName === "string" ? slot.providerName.trim() : "";

  if (!start) {
    return providerName
      ? `Provider: ${providerName}`
      : "We are checking your appointment details.";
  }

  const date = new Date(start);
  if (Number.isNaN(date.getTime())) {
    return providerName
      ? `Provider: ${providerName}`
      : "We are checking your appointment details.";
  }

  const when = date.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return providerName ? `${when} with ${providerName}` : when;
}

export function checkoutReturnView(
  bookingIntent: BookingIntentReturnRow | null,
): CheckoutReturnView {
  if (!bookingIntent) {
    return {
      tone: "review",
      icon: "!",
      title: "We could not find that checkout",
      lead: "Your appointment status is not available from this link.",
      summary: "Return to your hub to check the latest appointment information.",
      hint: "If payment went through, we can still reconcile the request from Stripe and Ola records.",
    };
  }

  const summary = selectedSlotSummary(bookingIntent.selected_slot);

  if (
    bookingIntent.booking_status === "booked" &&
    bookingIntent.payment_status === "paid" &&
    bookingIntent.ola_status === "booked"
  ) {
    return {
      tone: "success",
      icon: "✓",
      title: "Appointment booked",
      lead: "Your payment was received and your appointment is booked.",
      summary,
      hint: "You can return to your hub to view visit details and next steps.",
    };
  }

  if (bookingIntent.booking_status === "action_required") {
    return {
      tone: "action",
      icon: "!",
      title: "Next steps ready",
      lead: "Your payment was received and your provider booking is ready.",
      summary,
      hint: "Review the provider next steps before continuing outside Greymatter.",
    };
  }

  if (bookingIntent.booking_status === "needs_review") {
    return {
      tone: "review",
      icon: "!",
      title: "Payment received",
      lead: "We are reviewing your appointment request.",
      summary,
      hint: "Your payment succeeded, but automatic provider booking did not finish. We will follow up with next steps.",
    };
  }

  return {
    tone: "pending",
    icon: "...",
    title: "Payment received",
    lead: "We are finishing your appointment request.",
    summary,
    hint: "This can take a moment after checkout. Refresh this page or return to your hub for the latest status.",
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
