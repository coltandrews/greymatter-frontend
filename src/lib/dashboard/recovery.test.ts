import { describe, expect, it } from "vitest";
import {
  canRetryOlaBooking,
  recoveryDiagnosticDetails,
  recoveryBookingTime,
  recoveryBookingTitle,
  recoveryPharmacySummary,
  recoveryStateSummary,
  type StaffRecoveryBooking,
} from "./recovery";

const row: StaffRecoveryBooking = {
  id: "booking-1",
  user_id: "user-1",
  payment_status: "paid",
  booking_status: "needs_review",
  ola_status: "failed",
  service_state: "SC",
  selected_slot: {
    start: "2026-05-04T14:00:00.000Z",
    providerName: "Dr Provider",
  },
  selected_pharmacy: {
    name: "Test Pharmacy",
    ncpdpId: "1234567",
    phone: "555-555-5555",
  },
  vendor_metadata: {
    message: "Provider schedule is no longer available.",
    status: 409,
  },
  ola_order_guid: null,
  ola_redirect_url: null,
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

  it("summarizes pharmacy and status context", () => {
    expect(recoveryPharmacySummary(row)).toBe("Test Pharmacy · NCPDP 1234567 · Phone 555-555-5555");
    expect(recoveryStateSummary(row)).toBe("Payment paid · Booking request needs_review · Provider handoff failed · State SC");
  });

  it("formats diagnostic details without raw JSON", () => {
    expect(recoveryDiagnosticDetails(row)).toEqual([
      { label: "Failure reason", value: "Slot unavailable" },
      { label: "Provider message", value: "Provider schedule is no longer available." },
      { label: "Provider status", value: "409" },
      { label: "Booking ID", value: "booking-1", mono: true },
      { label: "Patient ID", value: "user-1", mono: true },
    ]);
  });
});
