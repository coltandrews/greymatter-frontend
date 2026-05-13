import { describe, expect, it } from "vitest";
import {
  medicationRequestAgeLabel,
  medicationRequestIdStatus,
  medicationRequestLifecycleCounts,
  medicationRequestNeedsAttention,
  medicationRequestPatientName,
  medicationRequestPhoneLast4,
  medicationRequestShippingSummary,
  medicationRequestStatusView,
  medicationRequestTreatmentAnswerCount,
  medicationRequestTreatmentLabel,
} from "./medicationRequests";

const intake = {
  legal_first_name: "Pat",
  legal_last_name: "Patient",
  phone: "+1 (555) 222-3344",
  street_address: "2402 Myrtle Avenue",
  city: "Sullivans Island",
  address_state: "SC",
  zip: "29482",
  selected_treatment: "glp_1",
  treatment_answers: {
    glp_1_current_height: "72",
    glp_1_current_weight: "210",
    glp_1_prior_use: "No",
    empty: "",
    multi: ["one", ""],
  },
};

describe("medication request dashboard helpers", () => {
  it("normalizes lifecycle status for the new patient flow", () => {
    expect(
      medicationRequestStatusView({
        bookingStatus: "payment_pending",
        paymentStatus: "pending",
        olaStatus: "not_started",
      }),
    ).toMatchObject({ key: "payment_pending", label: "Payment pending", submitted: false });

    expect(
      medicationRequestStatusView({
        bookingStatus: "ola_pending",
        paymentStatus: "paid",
        olaStatus: "pending",
      }),
    ).toMatchObject({ key: "provider_handoff", label: "Provider handoff", submitted: true });

    expect(
      medicationRequestStatusView({
        bookingStatus: "needs_review",
        paymentStatus: "paid",
        olaStatus: "pending",
      }),
    ).toMatchObject({ key: "under_review", label: "Under review" });

    expect(
      medicationRequestStatusView({
        bookingStatus: "needs_review",
        paymentStatus: "paid",
        olaStatus: "failed",
        failureReason: "Ola rejected request",
      }),
    ).toMatchObject({ key: "needs_attention", label: "Needs attention", tone: "failed" });
  });

  it("extracts high-signal patient, treatment, and shipping labels", () => {
    expect(medicationRequestPatientName(intake)).toBe("Pat Patient");
    expect(medicationRequestPhoneLast4(intake)).toBe("3344");
    expect(medicationRequestTreatmentLabel(intake)).toBe("GLP-1");
    expect(medicationRequestTreatmentAnswerCount(intake)).toBe(4);
    expect(medicationRequestShippingSummary(intake)).toBe(
      "2402 Myrtle Avenue · Sullivans Island, SC 29482",
    );
  });

  it("normalizes front and back ID status", () => {
    expect(medicationRequestIdStatus([])).toMatchObject({
      complete: false,
      label: "ID missing",
    });
    expect(
      medicationRequestIdStatus([
        { kind: "government_id_front", sentToOlaAt: "2026-05-12T12:00:00.000Z" },
        { kind: "government_id_back", sentToOlaAt: "2026-05-12T12:00:00.000Z" },
      ]),
    ).toEqual({
      frontUploaded: true,
      backUploaded: true,
      complete: true,
      sentToOla: true,
      label: "ID sent to provider",
    });
  });

  it("flags attention reasons that admin pages should prioritize", () => {
    const status = medicationRequestStatusView({
      bookingStatus: "needs_review",
      paymentStatus: "paid",
      olaStatus: "failed",
      failureReason: "Ola request failed",
    });
    expect(
      medicationRequestNeedsAttention({
        status,
        intakeData: { selected_treatment: "glp_1" },
        idStatus: medicationRequestIdStatus([{ kind: "government_id_front" }]),
        updatedAt: "2026-05-10T12:00:00.000Z",
        now: new Date("2026-05-12T13:00:00.000Z"),
      }),
    ).toEqual({
      needsAttention: true,
      reasons: ["provider_handoff_failed", "missing_id", "missing_shipping"],
    });
  });

  it("counts normalized lifecycle states", () => {
    expect(
      medicationRequestLifecycleCounts([
        { bookingStatus: "payment_pending", paymentStatus: "pending", olaStatus: "not_started" },
        { bookingStatus: "paid", paymentStatus: "paid", olaStatus: "not_started" },
        { bookingStatus: "needs_review", paymentStatus: "paid", olaStatus: "pending" },
        { bookingStatus: "needs_review", paymentStatus: "paid", olaStatus: "failed" },
        { bookingStatus: "action_required", paymentStatus: "paid", olaStatus: "booked" },
        { bookingStatus: "booked", paymentStatus: "paid", olaStatus: "booked" },
      ]),
    ).toEqual({
      paymentPending: 1,
      providerHandoff: 1,
      underReview: 1,
      needsAttention: 1,
      nextSteps: 1,
      confirmed: 1,
      cancelled: 0,
    });
  });

  it("formats relative request age", () => {
    const now = new Date("2026-05-12T13:00:00.000Z");
    expect(medicationRequestAgeLabel("2026-05-12T12:45:00.000Z", now)).toBe("15m ago");
    expect(medicationRequestAgeLabel("2026-05-12T10:00:00.000Z", now)).toBe("3h ago");
    expect(medicationRequestAgeLabel("2026-05-10T12:00:00.000Z", now)).toBe("2d ago");
  });
});
