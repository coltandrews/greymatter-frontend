import type { IntakeDraftData } from "@/lib/intake/draftData";
import {
  defaultPreSignupQuestions,
  formatQuestionAnswersForPayload,
} from "@/lib/intake/intakeQuestions";
import { isTreatmentKey, treatmentByKey, visibleTreatmentQuestions } from "@/lib/treatments";

export const GREYMATTER_SERVICE_KEY =
  "MetaHealthRX - Oral Semaglutide Dissolvable Tablets";

export type BookingIntentPayload = {
  productKey?: string;
  serviceState: string;
  serviceKey: string;
  serviceType: "initial";
  intakeData: IntakeDraftData;
  appointmentAnswers: Record<string, string>;
  selectedSlot?: {
    start: string;
    end: string;
    providerGuid: string;
    providerName: string;
  };
};

export function buildTreatmentBookingIntentPayload(
  patient: IntakeDraftData,
): BookingIntentPayload {
  const treatment = treatmentByKey(patient.selected_treatment);
  const questionSetKey = isTreatmentKey(patient.selected_treatment_question_set?.treatmentKey)
    ? patient.selected_treatment_question_set.treatmentKey
    : treatment?.key ?? null;
  const medicationQuestions = visibleTreatmentQuestions(
    questionSetKey,
    patient.treatment_answers,
  );
  return {
    productKey: patient.selected_treatment?.trim() || treatment?.key,
    serviceState: (patient.service_state ?? patient.address_state ?? "").trim(),
    serviceKey: treatment?.serviceKey ?? GREYMATTER_SERVICE_KEY,
    serviceType: "initial",
    intakeData: patient,
    appointmentAnswers: {
      ...formatQuestionAnswersForPayload(
        defaultPreSignupQuestions,
        patient.pre_signup_answers,
      ),
      ...formatQuestionAnswersForPayload(
        medicationQuestions,
        patient.treatment_answers,
      ),
    },
  };
}
