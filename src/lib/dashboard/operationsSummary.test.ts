import { describe, expect, it } from "vitest";
import { bookingOperationsSummary } from "./operationsSummary";

describe("bookingOperationsSummary", () => {
  it("counts operational booking states for staff", () => {
    expect(
      bookingOperationsSummary([
        {
          payment_status: "pending",
          booking_status: "payment_pending",
          ola_status: "not_started",
        },
        {
          payment_status: "paid",
          booking_status: "paid",
          ola_status: "not_started",
        },
        {
          payment_status: "paid",
          booking_status: "ola_pending",
          ola_status: "pending",
        },
        {
          payment_status: "paid",
          booking_status: "booked",
          ola_status: "booked",
        },
        {
          payment_status: "paid",
          booking_status: "action_required",
          ola_status: "booked",
        },
        {
          payment_status: "paid",
          booking_status: "needs_review",
          ola_status: "failed",
        },
      ]),
    ).toEqual({
      paymentPending: 1,
      olaPending: 2,
      booked: 2,
      needsReview: 1,
    });
  });

  it("does not double-count needs_review or booked states", () => {
    expect(
      bookingOperationsSummary([
        {
          payment_status: "paid",
          booking_status: "needs_review",
          ola_status: "pending",
        },
        {
          payment_status: "pending",
          booking_status: "booked",
          ola_status: "booked",
        },
      ]),
    ).toEqual({
      paymentPending: 0,
      olaPending: 0,
      booked: 1,
      needsReview: 1,
    });
  });
});
