export type BookingOperationsRow = {
  payment_status: string | null;
  booking_status: string | null;
  ola_status: string | null;
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
  return rows.reduce<BookingOperationsSummary>(
    (summary, row) => {
      if (row.booking_status === "needs_review") {
        summary.needsReview += 1;
        return summary;
      }
      if (row.booking_status === "booked" && row.ola_status === "booked") {
        summary.booked += 1;
        return summary;
      }
      if (
        row.payment_status === "paid" &&
        (row.booking_status === "paid" ||
          row.booking_status === "ola_pending" ||
          row.ola_status === "pending")
      ) {
        summary.olaPending += 1;
        return summary;
      }
      if (
        row.payment_status === "pending" ||
        row.booking_status === "payment_pending"
      ) {
        summary.paymentPending += 1;
      }
      return summary;
    },
    {
      paymentPending: 0,
      olaPending: 0,
      booked: 0,
      needsReview: 0,
    },
  );
}
