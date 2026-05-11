import type { IntakeDraftData } from "@/lib/intake/draftData";
import { APPOINTMENT_QUESTIONS } from "@/lib/scheduling/appointmentQuestions";
import type { SlotDisplay } from "@/lib/scheduling/olaProviderSchedules";

export const GREYMATTER_SERVICE_KEY =
  "MetaHealthRX - Oral Semaglutide Dissolvable Tablets";

export type BookingIntentPayload = {
  serviceState: string;
  serviceKey: string;
  serviceType: "initial";
  intakeData: IntakeDraftData;
  appointmentAnswers: Record<string, string>;
  selectedSlot: {
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
