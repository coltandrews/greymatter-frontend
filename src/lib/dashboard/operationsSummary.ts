import { medicationRequestLifecycleCounts } from "./medicationRequests";

export type BookingOperationsRow = {
  payment_status: string | null;
  booking_status: string | null;
  ola_status: string | null;
  failure_reason?: string | null;
};

export type BookingOperationsSummary = {
  paymentPending: number;
  olaPending: number;
  booked: number;
  needsReview: number;
};

export function bookingOperationsSummary(
  rows: BookingOperationsRow[],
): BookingOperationsSummary {
  const lifecycle = medicationRequestLifecycleCounts(
    rows.map((row) => ({
      bookingStatus: row.booking_status,
      paymentStatus: row.payment_status,
      olaStatus: row.ola_status,
      failureReason: row.failure_reason,
    })),
  );

  return {
    paymentPending: lifecycle.paymentPending,
    olaPending: lifecycle.providerHandoff,
    booked: lifecycle.confirmed + lifecycle.nextSteps,
    needsReview: lifecycle.underReview + lifecycle.needsAttention,
  };
}
