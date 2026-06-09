import { describe, expect, it } from "vitest";
import {
  bookingLifecycleState,
  canRetryProviderHandoff,
  shouldPollBookingLifecycle,
} from "./bookingLifecycle";

describe("bookingLifecycleState", () => {
  it("keeps unpaid requests out of submitted provider states", () => {
    expect(bookingLifecycleState({
      bookingStatus: "payment_pending",
      paymentStatus: "pending",
      olaStatus: "not_started",
    })).toMatchObject({
      stage: "payment_pending",
      submitted: false,
      paymentComplete: false,
    });
  });

  it("classifies paid provider handoff states", () => {
    expect(bookingLifecycleState({
      bookingStatus: "paid",
      paymentStatus: "paid",
      olaStatus: "not_started",
    }).stage).toBe("provider_handoff");

    expect(bookingLifecycleState({
      bookingStatus: "needs_review",
      paymentStatus: "paid",
      olaStatus: "pending",
    }).stage).toBe("provider_review");

    expect(bookingLifecycleState({
      bookingStatus: "booked",
      paymentStatus: "paid",
      olaStatus: "booked",
    })).toMatchObject({
      stage: "provider_confirmed",
      terminal: true,
      providerComplete: true,
    });
  });

  it("prioritizes provider handoff failures over review and next-step states", () => {
    expect(bookingLifecycleState({
      bookingStatus: "needs_review",
      paymentStatus: "paid",
      olaStatus: "failed",
    })).toMatchObject({
      stage: "provider_handoff_failed",
      attentionRequired: true,
    });

    expect(bookingLifecycleState({
      bookingStatus: "action_required",
      paymentStatus: "paid",
      olaStatus: "failed",
      hasNextSteps: true,
    }).stage).toBe("provider_handoff_failed");
  });

  it("identifies states that can poll or retry", () => {
    const pending = {
      bookingStatus: "payment_pending",
      paymentStatus: "pending",
      olaStatus: "not_started",
    };
    const failed = {
      bookingStatus: "needs_review",
      paymentStatus: "paid",
      olaStatus: "failed",
    };

    expect(shouldPollBookingLifecycle(pending)).toBe(true);
    expect(shouldPollBookingLifecycle(failed)).toBe(false);
    expect(canRetryProviderHandoff(failed)).toBe(true);
    expect(canRetryProviderHandoff(pending)).toBe(false);
    expect(canRetryProviderHandoff({
      bookingStatus: "action_required",
      paymentStatus: "paid",
      olaStatus: "failed",
    })).toBe(false);
  });
});
