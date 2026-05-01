import { describe, expect, it } from "vitest";
import {
  canRetryOlaBooking,
  recoveryBookingTime,
  recoveryBookingTitle,
  type StaffRecoveryBooking,
} from "./recovery";

const row: StaffRecoveryBooking = {
  id: "booking-1",
  user_id: "user-1",
  payment_status: "paid",
  booking_status: "needs_review",
  ola_status: "failed",
  selected_slot: {
    start: "2026-05-04T14:00:00.000Z",
    providerName: "Dr Provider",
  },
  failure_reason: "Slot unavailable",
  created_at: "2026-05-01T12:00:00.000Z",
  updated_at: "2026-05-01T12:15:00.000Z",
};

describe("staff recovery booking helpers", () => {
  it("allows retry only for paid needs_review bookings", () => {
    expect(canRetryOlaBooking(row)).toBe(true);
    expect(canRetryOlaBooking({ ...row, payment_status: "pending" })).toBe(false);
    expect(canRetryOlaBooking({ ...row, booking_status: "booked" })).toBe(false);
  });

  it("uses provider and slot details for staff display", () => {
    expect(recoveryBookingTitle(row)).toBe("Dr Provider");
    expect(recoveryBookingTime(row)).toContain("2026");
  });

  it("falls back cleanly when slot details are missing", () => {
    expect(recoveryBookingTitle({ ...row, selected_slot: null })).toBe("Provider pending");
    expect(recoveryBookingTime({ ...row, selected_slot: null })).toContain("2026");
  });
});
