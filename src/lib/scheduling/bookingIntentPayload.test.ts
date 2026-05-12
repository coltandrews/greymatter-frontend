import { describe, expect, it } from "vitest";
import {
  buildBookingIntentPayload,
  buildTreatmentBookingIntentPayload,
  GREYMATTER_SERVICE_KEY,
} from "./bookingIntentPayload";

describe("buildBookingIntentPayload", () => {
  it("maps schedule selections into the backend booking intent shape", () => {
    const payload = buildBookingIntentPayload({
      answers: {
        visit_format: "video",
        additional_notes: "Reduce appetite",
      },
      patient: {
        legal_first_name: "Pat",
        legal_last_name: "Patient",
        service_state: "SC",
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
      selectedSlot: {
        providerGuid: "provider-guid",
        providerName: "Dr Provider",
      },
    });
  });

  it("builds a no-schedule treatment booking intent from saved intake", () => {
    const payload = buildTreatmentBookingIntentPayload({
      legal_first_name: "Pat",
      legal_last_name: "Patient",
      service_state: "SC",
      selected_treatment: "glp_1",
      pre_signup_answers: {
        service_state: "SC",
        for_self: "yes",
      },
      treatment_answers: {
        glp_1_current_weight: "210",
        glp_1_prior_use: "no",
      },
    });

    expect(payload).toMatchObject({
      serviceState: "SC",
      serviceKey: GREYMATTER_SERVICE_KEY,
      serviceType: "initial",
      appointmentAnswers: {
        State: "SC",
        "Are You Booking Care For Yourself?": "yes",
        "What is your current weight?": "210",
        "Have you used a GLP-1 medication before?": "no",
      },
    });
    expect(payload.selectedSlot).toBeUndefined();
  });
});
