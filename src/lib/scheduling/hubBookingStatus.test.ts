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
      subtitle: "Provider review received. Watch for medication updates.",
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
      subtitle: "Provider next steps are ready. Review them before continuing.",
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
      label: "Under review",
      tone: "review",
    });
  });

  it("shows payment pending before payment is complete", () => {
    expect(
      hubBookingIntentStatusView({
        booking_status: "payment_pending",
        payment_status: "pending",
        ola_status: "not_started",
      }),
    ).toEqual({
      label: "Payment Pending",
      subtitle: "Checkout is not complete. This medication request is not submitted yet.",
      tone: "pending",
    });
  });
});
