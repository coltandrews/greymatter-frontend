import { describe, expect, it } from "vitest";
import { buildBookingIntentPayload, GREYMATTER_SERVICE_KEY } from "./bookingIntentPayload";

describe("buildBookingIntentPayload", () => {
  it("maps schedule selections into the backend booking intent shape", () => {
    const payload = buildBookingIntentPayload({
      answers: {
        visit_format: "video",
        additional_notes: "Reduce appetite",
      },
      insurance: {
        insurance_member_id: " member-123 ",
        insurance_plan_name: " Test Plan ",
        payer_identification: " payer-1 ",
        cover_type: " Primary ",
      },
      patient: {
        legal_first_name: "Pat",
        legal_last_name: "Patient",
        service_state: "SC",
      },
      pharmacy: {
        name: " Test Pharmacy ",
        address: " 123 Main St ",
        phone: " 555-555-1212 ",
        fax: " 555-555-3434 ",
        ncpdpId: " 1234567 ",
      },
      selectedSlot: {
        id: "slot-1",
        start: "2026-05-04T14:00:00.000Z",
        end: "2026-05-04T14:15:00.000Z",
        label: "10:00 AM",
        provider: "Dr Provider",
        providerGuid: "provider-guid",
      },
      serviceState: " SC ",
    });

    expect(payload).toMatchObject({
      serviceState: "SC",
      serviceKey: GREYMATTER_SERVICE_KEY,
      serviceType: "initial",
      appointmentAnswers: {
        "Preferred visit format": "Video visit",
        "Anything else we should know? (optional)": "Reduce appetite",
      },
      selectedPharmacy: {
        name: "Test Pharmacy",
        ncpdpId: "1234567",
      },
      selectedSlot: {
        providerGuid: "provider-guid",
        providerName: "Dr Provider",
      },
      insuranceDetails: {
        memberId: "member-123",
        planName: "Test Plan",
        payerId: "payer-1",
        coverageType: "Primary",
      },
    });
  });
});
