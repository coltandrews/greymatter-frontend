export const BOOKING_STATUSES = [
  "draft",
  "ready_for_payment",
  "payment_pending",
  "paid",
  "ola_pending",
  "booked",
  "action_required",
  "needs_review",
  "cancelled",
] as const;

export const PAYMENT_STATUSES = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;

export const OLA_STATUSES = [
  "not_started",
  "pending",
  "booked",
  "failed",
] as const;

export type BookingStatus = typeof BOOKING_STATUSES[number];
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
export type OlaStatus = typeof OLA_STATUSES[number];

export type BookingLifecycleStage =
  | "draft"
  | "payment_pending"
  | "payment_failed"
  | "provider_handoff"
  | "provider_review"
  | "provider_handoff_failed"
  | "provider_next_steps"
  | "provider_confirmed"
  | "cancelled";

export type BookingLifecycleInput = {
  bookingStatus?: string | null;
  paymentStatus?: string | null;
  olaStatus?: string | null;
  failureReason?: string | null;
  hasNextSteps?: boolean | null;
};

export type BookingLifecycleState = {
  stage: BookingLifecycleStage;
  submitted: boolean;
  terminal: boolean;
  paymentComplete: boolean;
  providerComplete: boolean;
  attentionRequired: boolean;
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function providerHandoffFailed(input: BookingLifecycleInput): boolean {
  return input.olaStatus === "failed" || hasText(input.failureReason);
}

export function bookingLifecycleState(
  input: BookingLifecycleInput,
): BookingLifecycleState {
  const paymentComplete = input.paymentStatus === "paid";

  if (input.bookingStatus === "cancelled") {
    return {
      stage: "cancelled",
      submitted: false,
      terminal: true,
      paymentComplete,
      providerComplete: false,
      attentionRequired: false,
    };
  }

  if (input.paymentStatus === "failed") {
    return {
      stage: "payment_failed",
      submitted: false,
      terminal: false,
      paymentComplete: false,
      providerComplete: false,
      attentionRequired: true,
    };
  }

  if (input.bookingStatus === "draft") {
    return {
      stage: "draft",
      submitted: false,
      terminal: false,
      paymentComplete: false,
      providerComplete: false,
      attentionRequired: false,
    };
  }

  if (
    !paymentComplete ||
    input.bookingStatus === "ready_for_payment" ||
    input.bookingStatus === "payment_pending"
  ) {
    return {
      stage: "payment_pending",
      submitted: false,
      terminal: false,
      paymentComplete: false,
      providerComplete: false,
      attentionRequired: false,
    };
  }

  if (providerHandoffFailed(input)) {
    return {
      stage: "provider_handoff_failed",
      submitted: true,
      terminal: false,
      paymentComplete: true,
      providerComplete: false,
      attentionRequired: true,
    };
  }

  if (input.bookingStatus === "action_required" || input.hasNextSteps) {
    return {
      stage: "provider_next_steps",
      submitted: true,
      terminal: false,
      paymentComplete: true,
      providerComplete: true,
      attentionRequired: false,
    };
  }

  if (input.bookingStatus === "booked" && input.olaStatus === "booked") {
    return {
      stage: "provider_confirmed",
      submitted: true,
      terminal: true,
      paymentComplete: true,
      providerComplete: true,
      attentionRequired: false,
    };
  }

  if (input.bookingStatus === "needs_review") {
    return {
      stage: "provider_review",
      submitted: true,
      terminal: false,
      paymentComplete: true,
      providerComplete: false,
      attentionRequired: false,
    };
  }

  return {
    stage: "provider_handoff",
    submitted: true,
    terminal: false,
    paymentComplete: true,
    providerComplete: false,
    attentionRequired: false,
  };
}

export function shouldPollBookingLifecycle(input: BookingLifecycleInput): boolean {
  const state = bookingLifecycleState(input);
  return state.stage === "payment_pending" || state.stage === "provider_handoff";
}

export function canRetryProviderHandoff(input: BookingLifecycleInput): boolean {
  return (
    input.bookingStatus === "needs_review" &&
    input.paymentStatus === "paid" &&
    bookingLifecycleState(input).stage === "provider_handoff_failed"
  );
}
