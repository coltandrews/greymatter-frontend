import { bookingLifecycleState } from "./bookingLifecycle";

export type PatientTimelineInput = {
  booking_status: string | null;
  payment_status: string | null;
  ola_status: string | null;
  has_next_steps?: boolean;
};

export type PatientTimelineStep = {
  key: "payment" | "provider" | "next_steps" | "visit";
  label: string;
  description: string;
  state: "complete" | "current" | "pending" | "attention";
};

export function patientBookingTimeline(
  input: PatientTimelineInput,
): PatientTimelineStep[] {
  const lifecycle = bookingLifecycleState({
    bookingStatus: input.booking_status,
    paymentStatus: input.payment_status,
    olaStatus: input.ola_status,
    hasNextSteps: input.has_next_steps,
  });
  const paymentComplete = lifecycle.paymentComplete;
  const paymentFailed = lifecycle.stage === "payment_failed";
  const needsReview = lifecycle.stage === "provider_review";
  const providerSendFailed = lifecycle.stage === "provider_handoff_failed";
  const providerBooked = lifecycle.providerComplete;
  const hasNextSteps = lifecycle.stage === "provider_next_steps";
  const providerDescription = providerSendFailed
    ? "This request needs attention before provider review can begin"
    : providerBooked
      ? "Provider review ready"
      : needsReview
        ? "Waiting for provider network response"
        : paymentComplete
          ? "Provider review in progress"
          : "Starts after payment is complete";
  const providerState: PatientTimelineStep["state"] = providerBooked
    ? "complete"
    : providerSendFailed
      ? "attention"
      : needsReview || paymentComplete
        ? "current"
        : "pending";

  return [
    {
      key: "payment",
      label: "Payment",
      description: paymentComplete
        ? "Payment received"
        : paymentFailed
          ? "Payment did not complete. Medication request is not submitted yet."
          : "Checkout is not complete. Medication request is not submitted yet.",
      state: paymentComplete ? "complete" : paymentFailed ? "attention" : "current",
    },
    {
      key: "provider",
      label: "Provider review",
      description: providerDescription,
      state: providerState,
    },
    {
      key: "next_steps",
      label: "Next steps",
      description: hasNextSteps
        ? "Review next steps"
        : providerBooked
          ? "No extra handoff is available yet"
          : "Available after provider review",
      state: hasNextSteps
        ? "current"
        : providerBooked
          ? "pending"
          : "pending",
    },
    {
      key: "visit",
      label: "Medication review",
      description: providerBooked
        ? "Follow provider instructions"
        : needsReview
          ? "If you are not eligible, your payment will be refunded"
          : "Pending provider review",
      state: providerBooked && !hasNextSteps ? "current" : "pending",
    },
  ];
}
