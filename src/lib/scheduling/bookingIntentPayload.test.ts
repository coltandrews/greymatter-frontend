import { describe, expect, it } from "vitest";
import {
  buildTreatmentBookingIntentPayload,
  GREYMATTER_SERVICE_KEY,
} from "./bookingIntentPayload";

describe("buildTreatmentBookingIntentPayload", () => {
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
        glp_1_current_height: "5'10",
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
        "What is your height?": "5'10",
        "What is your current weight?": "210",
        "Have you used a GLP-1 medication before?": "no",
      },
    });
    expect(payload.selectedSlot).toBeUndefined();
  });
});
