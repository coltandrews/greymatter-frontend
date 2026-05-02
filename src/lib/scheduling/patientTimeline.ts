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
  const providerBooked =
    input.ola_status === "booked" &&
    (input.booking_status === "booked" || input.booking_status === "action_required");
  const hasNextSteps = input.has_next_steps || input.booking_status === "action_required";

  return [
    {
      key: "payment",
      label: "Payment",
      description: paymentComplete
        ? "Payment received"
        : "Checkout is not complete. Appointment is not booked yet.",
      state: paymentComplete ? "complete" : "current",
    },
    {
      key: "provider",
      label: "Provider booking",
      description: providerBooked
        ? "Provider booking ready"
        : needsReview
          ? "Staff is reviewing this booking"
          : paymentComplete
            ? "Provider booking in progress"
            : "Starts after payment is complete",
      state: providerBooked
        ? "complete"
        : needsReview
          ? "attention"
          : paymentComplete
            ? "current"
            : "pending",
    },
    {
      key: "next_steps",
      label: "Next steps",
      description: hasNextSteps
        ? "Review next steps"
        : providerBooked
          ? "No extra handoff is available yet"
          : "Available after provider booking",
      state: hasNextSteps
        ? "current"
        : providerBooked
          ? "pending"
          : "pending",
    },
    {
      key: "visit",
      label: "Visit / review",
      description: providerBooked
        ? "Follow provider instructions"
        : needsReview
          ? "We will follow up"
          : "Pending provider booking",
      state: providerBooked && !hasNextSteps ? "current" : "pending",
    },
  ];
}
