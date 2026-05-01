import { describe, expect, it } from "vitest";
import type { PatientLookupPatient } from "@/lib/api/admin";
import {
  patientLookupActivitySummary,
  patientLookupAppointmentLabel,
  patientLookupReference,
  patientLookupSummary,
} from "./patientLookup";

const patient: PatientLookupPatient = {
  userId: "user-1",
  email: "pat@example.com",
  name: "Pat Patient",
  serviceState: "SC",
  latestSubmission: {
    id: "submission-1",
    status: "needs_review",
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
  bookings: [
    {
      id: "booking-1",
      userId: "user-1",
      patientName: "Pat Patient",
      patientEmail: "pat@example.com",
      serviceState: "SC",
      bookingStatus: "booked",
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
    },
  ],
  appointments: [
    {
      id: "appointment-1",
      status: "booked",
      startsAt: "2026-05-04T14:00:00.000Z",
      providerName: "Dr Provider",
      olaOrderGuid: "ola-order-1",
      hasNextSteps: true,
      updatedAt: "2026-05-01T11:00:00.000Z",
    },
  ],
};

describe("patient lookup helpers", () => {
  it("summarizes patient identity and activity", () => {
    expect(patientLookupSummary(patient)).toBe("pat@example.com · State SC · Intake needs review");
    expect(patientLookupActivitySummary(patient)).toBe("1 booking · 1 appointment");
    expect(patientLookupReference(patient)).toBe("pat@example.com");
  });

  it("formats appointment labels", () => {
    expect(patientLookupAppointmentLabel(patient.appointments[0])).toContain("Dr Provider");
  });

  it("falls back when email and submission are missing", () => {
    expect(patientLookupSummary({
      ...patient,
      email: null,
      latestSubmission: null,
    })).toBe("State SC · No submission");
    expect(patientLookupReference({ ...patient, email: null })).toBe("user-1");
  });
});
