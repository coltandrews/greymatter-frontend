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
      subtitle: "Provider review received. Watch for medication and shipment updates.",
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
      subtitle: "Provider next steps are ready. If you are not eligible, your payment will be refunded.",
      tone: "action",
    });
  });

  it("shows provider handoff failure when Ola rejects a paid booking", () => {
    expect(
      hubBookingIntentStatusView({
        booking_status: "needs_review",
        payment_status: "paid",
        ola_status: "failed",
        failure_reason: "No provider found for given service and state",
      }),
    ).toMatchObject({
      label: "Provider handoff failed",
      subtitle:
        "Payment received, but provider handoff failed: No provider found for given service and state.",
      tone: "failed",
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
