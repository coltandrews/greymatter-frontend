import { describe, expect, it } from "vitest";
import { checkoutReturnView, shouldPollCheckoutReturn } from "./checkoutReturn";

describe("checkoutReturnView", () => {
  it("shows booked copy only after payment and Ola booking are complete", () => {
    expect(
      checkoutReturnView({
        booking_status: "booked",
        payment_status: "paid",
        ola_status: "booked",
        selected_slot: {
          start: "2026-05-04T14:00:00.000Z",
          providerName: "Dr Provider",
        },
      }),
    ).toMatchObject({
      tone: "success",
      title: "Appointment booked",
      lead: "Your payment was received and your appointment is booked.",
    });
  });

  it("shows pending copy while the webhook or Ola booking is still running", () => {
    expect(
      checkoutReturnView({
        booking_status: "payment_pending",
        payment_status: "pending",
        ola_status: "not_started",
        selected_slot: {
          start: "2026-05-04T14:00:00.000Z",
        },
      }),
    ).toMatchObject({
      tone: "pending",
      title: "Payment received",
      lead: "We are finishing your appointment request.",
    });
  });

  it("shows action-required copy when Ola returns patient handoff steps", () => {
    expect(
      checkoutReturnView({
        booking_status: "action_required",
        payment_status: "paid",
        ola_status: "booked",
        selected_slot: {
          start: "2026-05-04T14:00:00.000Z",
          providerName: "Dr Provider",
        },
      }),
    ).toMatchObject({
      tone: "action",
      title: "Next steps ready",
      lead: "Your payment was received and your provider booking is ready.",
    });
  });

  it("shows review copy when payment succeeded but booking needs manual follow-up", () => {
    expect(
      checkoutReturnView({
        booking_status: "needs_review",
        payment_status: "paid",
        ola_status: "failed",
        selected_slot: null,
      }),
    ).toMatchObject({
      tone: "review",
      title: "Payment received",
      lead: "We are reviewing your appointment request.",
    });
  });

  it("does not expose raw failure details when no matching booking intent is found", () => {
    expect(checkoutReturnView(null)).toMatchObject({
      tone: "review",
      title: "We could not find that checkout",
    });
  });

  it("polls only while checkout booking is unresolved", () => {
    expect(shouldPollCheckoutReturn(null)).toBe(false);
    expect(
      shouldPollCheckoutReturn({
        booking_status: "payment_pending",
        payment_status: "pending",
        ola_status: "not_started",
        selected_slot: null,
      }),
    ).toBe(true);
    expect(
      shouldPollCheckoutReturn({
        booking_status: "booked",
        payment_status: "paid",
        ola_status: "booked",
        selected_slot: null,
      }),
    ).toBe(false);
    expect(
      shouldPollCheckoutReturn({
        booking_status: "action_required",
        payment_status: "paid",
        ola_status: "booked",
        selected_slot: null,
      }),
    ).toBe(false);
    expect(
      shouldPollCheckoutReturn({
        booking_status: "needs_review",
        payment_status: "paid",
        ola_status: "failed",
        selected_slot: null,
      }),
    ).toBe(false);
  });
});
