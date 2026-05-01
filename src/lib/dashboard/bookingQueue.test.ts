import { describe, expect, it } from "vitest";
import type { BookingQueueRow } from "@/lib/api/admin";
import {
  bookingQueuePatientLabel,
  bookingQueuePharmacyLabel,
  bookingQueueReference,
  bookingQueueSlotLabel,
  bookingQueueStatusView,
} from "./bookingQueue";

const row: BookingQueueRow = {
  id: "booking-1",
  userId: "user-1",
  patientName: "Pat Patient",
  patientEmail: "pat@example.com",
  serviceState: "SC",
  bookingStatus: "action_required",
  paymentStatus: "paid",
  olaStatus: "booked",
  providerName: "Dr Provider",
  slotStart: "2026-05-04T14:00:00.000Z",
  slotEnd: "2026-05-04T14:15:00.000Z",
  pharmacyName: "Test Pharmacy",
  pharmacyNcpdpId: "1234567",
  olaOrderGuid: "ola-order-1",
  hasNextSteps: true,
  failureReason: null,
  createdAt: "2026-05-01T10:00:00.000Z",
  updatedAt: "2026-05-01T11:00:00.000Z",
};

describe("booking queue helpers", () => {
  it("formats patient, slot, pharmacy, and reference labels", () => {
    expect(bookingQueuePatientLabel(row)).toBe("Pat Patient · pat@example.com");
    expect(bookingQueueSlotLabel(row)).toContain("Dr Provider");
    expect(bookingQueuePharmacyLabel(row)).toBe("Test Pharmacy · NCPDP 1234567");
    expect(bookingQueueReference(row)).toBe("ola-order-1");
  });

  it("uses status copy from booking intent status rules", () => {
    expect(bookingQueueStatusView(row)).toMatchObject({
      label: "Next steps",
      color: "#92400e",
    });
  });

  it("falls back for missing optional queue details", () => {
    const missing = {
      ...row,
      patientEmail: null,
      providerName: null,
      slotStart: null,
      pharmacyName: null,
      pharmacyNcpdpId: null,
      olaOrderGuid: null,
    };

    expect(bookingQueuePatientLabel(missing)).toBe("Pat Patient");
    expect(bookingQueueSlotLabel(missing)).toBe("Provider pending");
    expect(bookingQueuePharmacyLabel(missing)).toBe("Pharmacy pending");
    expect(bookingQueueReference(missing)).toBe("booking-1");
  });
});
