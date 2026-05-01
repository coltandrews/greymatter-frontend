import { describe, expect, it } from "vitest";
import { hubBookingIntentStatusView } from "./hubBookingStatus";

describe("hubBookingIntentStatusView", () => {
  it("shows confirmed only after payment and Ola booking are complete", () => {
    expect(
      hubBookingIntentStatusView({
        booking_status: "booked",
        payment_status: "paid",
        ola_status: "booked",
      }),
    ).toEqual({
      label: "Confirmed",
      subtitle: "Initial semaglutide consultation",
      tone: "confirmed",
    });
  });

  it("shows processing after payment while provider booking is not complete", () => {
    expect(
      hubBookingIntentStatusView({
        booking_status: "ola_pending",
        payment_status: "paid",
        ola_status: "pending",
      }),
    ).toMatchObject({
      label: "Processing",
      tone: "pending",
    });
  });

  it("shows next steps when the provider booking requires patient action", () => {
    expect(
      hubBookingIntentStatusView({
        booking_status: "action_required",
        payment_status: "paid",
        ola_status: "booked",
      }),
    ).toEqual({
      label: "Next steps",
      subtitle: "Provider booking is ready. Review the next steps.",
      tone: "action",
    });
  });

  it("shows review when paid booking needs manual follow-up", () => {
    expect(
      hubBookingIntentStatusView({
        booking_status: "needs_review",
        payment_status: "paid",
        ola_status: "failed",
      }),
    ).toMatchObject({
      label: "Needs review",
      tone: "review",
    });
  });

  it("shows pending before payment is complete", () => {
    expect(
      hubBookingIntentStatusView({
        booking_status: "payment_pending",
        payment_status: "pending",
        ola_status: "not_started",
      }),
    ).toMatchObject({
      label: "Pending",
      tone: "pending",
    });
  });
});
