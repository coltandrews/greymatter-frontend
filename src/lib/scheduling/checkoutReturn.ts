import {
  bookingLifecycleState,
  shouldPollBookingLifecycle,
} from "./bookingLifecycle";

export type BookingIntentReturnRow = {
  id: string | null;
  booking_status: string | null;
  payment_status: string | null;
  ola_status: string | null;
  ola_redirect_url: string | null;
  failure_reason?: string | null;
  intake_data?: unknown;
  selected_slot: unknown;
};

export type CheckoutReturnView = {
  tone: "success" | "pending" | "action" | "review" | "failed";
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

export function patientProviderIssueMessage(reason: string | null | undefined): string {
  const normalized = reason?.trim().replace(/\s+/g, " ") ?? "";
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return "The provider request could not be sent. Your payment is recorded, and support can review this request.";
  }
  if (lower.includes("no provider found")) {
    return "No provider is currently available for this treatment in the selected state.";
  }
  if (lower.includes("service not found")) {
    return "This treatment is not ready for provider review yet.";
  }
  if (lower.includes("invalid tennant") || lower.includes("invalid tenant")) {
    return "This request needs support review before it can be sent to the provider.";
  }
  if (lower.includes("invalid secret") || lower.includes("token")) {
    return "This request needs support review before it can be sent to the provider.";
  }
  if (lower.includes("government id") || lower.includes("id upload")) {
    return "Government ID upload is missing or could not be sent.";
  }
  if (lower.includes("missing a selected treatment")) {
    return "This request is missing the selected treatment. Please start the treatment request again.";
  }
  if (lower.includes("selected treatment is not active")) {
    return "This treatment is not available for checkout yet.";
  }
  if (lower.includes("stripe") || lower.includes("checkout")) {
    return "Checkout could not be opened. Please try again.";
  }

  return normalized;
}

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

  const lifecycle = bookingLifecycleState({
    bookingStatus: bookingIntent.booking_status,
    paymentStatus: bookingIntent.payment_status,
    olaStatus: bookingIntent.ola_status,
    failureReason: bookingIntent.failure_reason,
  });
  const summary = "";
  const failureReason = bookingIntent.failure_reason?.trim();

  if (lifecycle.stage === "provider_handoff_failed") {
    const issue = patientProviderIssueMessage(failureReason);
    return {
      tone: "failed",
      icon: "!",
      title: "Request needs attention",
      lead: `Payment is confirmed, but we could not send your request for provider review. ${issue}`,
      summary,
      hint: "Support can correct this before provider review begins.",
    };
  }

  if (lifecycle.stage === "provider_confirmed") {
    return {
      tone: "success",
      icon: "✓",
      title: "Request submitted",
      lead: "Your request was sent for review.",
      summary,
      hint: "You can track updates from your portal.",
    };
  }

  if (lifecycle.stage === "provider_next_steps") {
    return {
      tone: "action",
      icon: "!",
      title: "Next steps ready",
      lead: "Your next steps are ready.",
      summary,
      hint: "Review the next steps when you are ready.",
    };
  }

  if (lifecycle.stage === "provider_review") {
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
  const lifecycle = bookingIntent
    ? bookingLifecycleState({
        bookingStatus: bookingIntent.booking_status,
        paymentStatus: bookingIntent.payment_status,
        olaStatus: bookingIntent.ola_status,
        failureReason: bookingIntent.failure_reason,
      })
    : null;
  if (
    lifecycle?.stage !== "provider_next_steps" ||
    !bookingIntent ||
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
  return shouldPollBookingLifecycle({
    bookingStatus: bookingIntent.booking_status,
    paymentStatus: bookingIntent.payment_status,
    olaStatus: bookingIntent.ola_status,
    failureReason: bookingIntent.failure_reason,
  });
}
