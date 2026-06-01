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
  const paymentComplete = input.payment_status === "paid";
  const needsReview = input.booking_status === "needs_review";
  const providerSendFailed = input.ola_status === "failed";
  const providerBooked =
    input.ola_status === "booked" &&
    (input.booking_status === "booked" || input.booking_status === "action_required");
  const hasNextSteps = input.has_next_steps || input.booking_status === "action_required";
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
        : "Checkout is not complete. Medication request is not submitted yet.",
      state: paymentComplete ? "complete" : "current",
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
