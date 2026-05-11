import type { IntakeDraftData } from "@/lib/intake/draftData";
import { APPOINTMENT_QUESTIONS } from "@/lib/scheduling/appointmentQuestions";
import type { SlotDisplay } from "@/lib/scheduling/olaProviderSchedules";
import { treatmentByKey } from "@/lib/treatments";

export const GREYMATTER_SERVICE_KEY =
  "MetaHealthRX - Oral Semaglutide Dissolvable Tablets";

export type BookingIntentPayload = {
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

function answerLabel(id: string, value: string): string {
  const question = APPOINTMENT_QUESTIONS.find((item) => item.id === id);
  if (!question || question.type !== "select") {
    return value;
  }
  return question.options.find((opt) => opt.value === value)?.label ?? value;
}

function flattenAnswers(
  answers: Record<string, string | string[]> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(answers ?? {})
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(", ") : value,
      ])
      .filter(([, value]) => value.trim()),
  );
}

export function buildTreatmentBookingIntentPayload(
  patient: IntakeDraftData,
): BookingIntentPayload {
  const treatment = treatmentByKey(patient.selected_treatment);
  return {
    serviceState: (patient.service_state ?? patient.address_state ?? "").trim(),
    serviceKey: treatment?.serviceKey ?? GREYMATTER_SERVICE_KEY,
    serviceType: "initial",
    intakeData: patient,
    appointmentAnswers: {
      ...flattenAnswers(patient.pre_signup_answers),
      ...flattenAnswers(patient.treatment_answers),
    },
  };
}

export function buildBookingIntentPayload({
  answers,
  patient,
  selectedSlot,
  serviceState,
  serviceKey = GREYMATTER_SERVICE_KEY,
}: {
  answers: Record<string, string>;
  patient: IntakeDraftData;
  selectedSlot: SlotDisplay;
  serviceState: string;
  serviceKey?: string;
}): BookingIntentPayload {
  return {
    serviceState: serviceState.trim(),
    serviceKey,
    serviceType: "initial",
    intakeData: patient,
    appointmentAnswers: Object.fromEntries(
      Object.entries(answers)
        .filter(([, value]) => value.trim())
        .map(([id, value]) => {
          const question = APPOINTMENT_QUESTIONS.find((q) => q.id === id);
          return [question?.label ?? id, answerLabel(id, value)];
      }),
    ),
    selectedSlot: {
      start: selectedSlot.start,
      end: selectedSlot.end,
      providerGuid: selectedSlot.providerGuid?.trim() ?? "",
      providerName: selectedSlot.provider?.trim() ?? "",
    },
  };
}
