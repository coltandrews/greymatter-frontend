import { describe, expect, it } from "vitest";
import {
  auditEventLabel,
  auditEventSummary,
  auditEventWhen,
  auditTargetLabel,
} from "./auditTrail";

const event = {
  id: "audit-1",
  actorUserId: "staff-1",
  patientUserId: "patient-1",
  bookingIntentId: "booking-1",
  appointmentId: null,
  action: "staff_note_added",
  note: "Called patient",
  metadata: {},
  createdAt: "2026-05-01T12:00:00.000Z",
};

describe("audit trail helpers", () => {
  it("formats audit labels and summaries", () => {
    expect(auditEventLabel(event)).toBe("Staff note");
    expect(auditEventSummary(event)).toBe("Called patient");
    expect(auditEventWhen(event)).toContain("2026");
  });

  it("falls back for unknown actions and invalid dates", () => {
    expect(auditEventLabel({ action: "custom_action" })).toBe("custom action");
    expect(auditEventWhen({ createdAt: "unknown" })).toBe("unknown");
  });

  it("labels audit note targets", () => {
    expect(auditTargetLabel({ bookingIntentId: "booking-1" })).toBe("booking");
    expect(auditTargetLabel({ appointmentId: "appointment-1" })).toBe("appointment");
    expect(auditTargetLabel({ patientUserId: "patient-1" })).toBe("patient");
  });
});
