import { describe, expect, it } from "vitest";
import {
  checkoutReturnAction,
  checkoutReturnView,
  shouldPollCheckoutReturn,
} from "./checkoutReturn";

describe("checkoutReturnView", () => {
  it("shows submitted copy only after payment and Ola handoff are complete", () => {
    expect(
      checkoutReturnView({
        booking_status: "booked",
        payment_status: "paid",
        ola_status: "booked",
        id: "booking-1",
        ola_redirect_url: null,
        selected_slot: {
          start: "2026-05-04T14:00:00.000Z",
          providerName: "Dr Provider",
        },
      }),
    ).toMatchObject({
      tone: "success",
      title: "Request submitted",
      lead: "Your request was sent for review.",
    });
  });

  it("shows pending copy while the webhook or Ola booking is still running", () => {
    expect(
      checkoutReturnView({
        booking_status: "payment_pending",
        payment_status: "pending",
        ola_status: "not_started",
        id: "booking-1",
        ola_redirect_url: null,
        selected_slot: {
          start: "2026-05-04T14:00:00.000Z",
        },
      }),
    ).toMatchObject({
      tone: "pending",
      title: "Processing request",
      lead: "Sending your request for review.",
    });
  });

  it("shows action-required copy when Ola returns patient handoff steps", () => {
    expect(
      checkoutReturnView({
        booking_status: "action_required",
        payment_status: "paid",
        ola_status: "booked",
        id: "booking-1",
        ola_redirect_url: "https://ola.example/next",
        selected_slot: {
          start: "2026-05-04T14:00:00.000Z",
          providerName: "Dr Provider",
        },
      }),
    ).toMatchObject({
      tone: "action",
      title: "Next steps ready",
      lead: "Your next steps are ready.",
    });
  });

  it("shows review copy when payment succeeded but booking needs manual follow-up", () => {
    expect(
      checkoutReturnView({
        booking_status: "needs_review",
        payment_status: "paid",
        ola_status: "failed",
        id: "booking-1",
        ola_redirect_url: null,
        selected_slot: null,
      }),
    ).toMatchObject({
      tone: "review",
      title: "Under review",
      lead: "Your request is being reviewed.",
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
        id: "booking-1",
        ola_redirect_url: null,
        selected_slot: null,
      }),
    ).toBe(true);
    expect(
      shouldPollCheckoutReturn({
        booking_status: "booked",
        payment_status: "paid",
        ola_status: "booked",
        id: "booking-1",
        ola_redirect_url: null,
        selected_slot: null,
      }),
    ).toBe(false);
    expect(
      shouldPollCheckoutReturn({
        booking_status: "action_required",
        payment_status: "paid",
        ola_status: "booked",
        id: "booking-1",
        ola_redirect_url: "https://ola.example/next",
        selected_slot: null,
      }),
    ).toBe(false);
    expect(
      shouldPollCheckoutReturn({
        booking_status: "needs_review",
        payment_status: "paid",
        ola_status: "failed",
        id: "booking-1",
        ola_redirect_url: null,
        selected_slot: null,
      }),
    ).toBe(false);
  });
});

describe("checkoutReturnAction", () => {
  it("links action-required bookings to the Greymatter handoff page", () => {
    expect(
      checkoutReturnAction({
        id: "booking/1",
        booking_status: "action_required",
        payment_status: "paid",
        ola_status: "booked",
        ola_redirect_url: "https://ola.example/next",
        selected_slot: null,
      }),
    ).toEqual({
      href: "/ola-handoff/booking/booking%2F1",
      label: "Review next steps",
    });
  });

  it("does not link without an Ola handoff URL", () => {
    expect(
      checkoutReturnAction({
        id: "booking-1",
        booking_status: "action_required",
        payment_status: "paid",
        ola_status: "booked",
        ola_redirect_url: null,
        selected_slot: null,
      }),
    ).toBeNull();
  });
});
