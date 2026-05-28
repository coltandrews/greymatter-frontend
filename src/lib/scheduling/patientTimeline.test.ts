import { describe, expect, it } from "vitest";
import { patientBookingTimeline } from "./patientTimeline";

describe("patientBookingTimeline", () => {
  it("shows provider review current after payment while Ola is pending", () => {
    expect(patientBookingTimeline({
      booking_status: "paid",
      payment_status: "paid",
      ola_status: "pending",
    }).map((step) => [step.key, step.state])).toEqual([
      ["payment", "complete"],
      ["provider", "current"],
      ["next_steps", "pending"],
      ["visit", "pending"],
    ]);
  });

  it("shows next steps current when Ola returns a handoff", () => {
    expect(patientBookingTimeline({
      booking_status: "action_required",
      payment_status: "paid",
      ola_status: "booked",
      has_next_steps: true,
    }).map((step) => [step.key, step.state])).toEqual([
      ["payment", "complete"],
      ["provider", "complete"],
      ["next_steps", "current"],
      ["visit", "pending"],
    ]);
  });

  it("keeps provider review current while the provider network is reviewing", () => {
    expect(patientBookingTimeline({
      booking_status: "needs_review",
      payment_status: "paid",
      ola_status: "failed",
    })[1]).toMatchObject({
      key: "provider",
      state: "current",
      description: "Waiting for provider network response",
    });
  });

  it("makes clear that unpaid requests are not submitted", () => {
    const timeline = patientBookingTimeline({
      booking_status: "payment_pending",
      payment_status: "pending",
      ola_status: "not_started",
    });

    expect(timeline[0]).toMatchObject({
      key: "payment",
      state: "current",
      description: "Checkout is not complete. Medication request is not submitted yet.",
    });
    expect(timeline[1]).toMatchObject({
      key: "provider",
      state: "pending",
      description: "Starts after payment is complete",
    });
  });
});
