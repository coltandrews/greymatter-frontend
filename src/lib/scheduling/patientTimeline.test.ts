import { describe, expect, it } from "vitest";
import { patientBookingTimeline } from "./patientTimeline";

describe("patientBookingTimeline", () => {
  it("shows provider booking current after payment while Ola is pending", () => {
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

  it("marks provider booking as attention when staff review is needed", () => {
    expect(patientBookingTimeline({
      booking_status: "needs_review",
      payment_status: "paid",
      ola_status: "failed",
    })[1]).toMatchObject({
      key: "provider",
      state: "attention",
    });
  });
});
