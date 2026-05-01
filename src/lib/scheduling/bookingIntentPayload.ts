import type { IntakeDraftData } from "@/lib/intake/draftData";
import { APPOINTMENT_QUESTIONS } from "@/lib/scheduling/appointmentQuestions";
import type { SlotDisplay } from "@/lib/scheduling/olaProviderSchedules";

export const GREYMATTER_SERVICE_KEY =
  "grey-matter-semaglutide-injection-one-month";

export type BookingIntentPharmacy = {
  name: string;
  address: string;
  phone: string;
  fax: string;
  ncpdpId: string;
};

export type BookingIntentInsurance = {
  insurance_member_id: string;
  insurance_plan_name: string;
  payer_identification: string;
  cover_type: string;
};

export type BookingIntentPayload = {
  serviceState: string;
  serviceKey: string;
  serviceType: "initial";
  intakeData: IntakeDraftData;
  appointmentAnswers: Record<string, string>;
  selectedPharmacy: {
    name: string;
    address: string;
    phone: string;
    fax: string;
    ncpdpId: string;
  };
  selectedSlot: {
    start: string;
    end: string;
    providerGuid: string;
    providerName: string;
  };
  insuranceDetails: {
    memberId: string;
    planName: string;
    payerId: string;
    coverageType: string;
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
  insurance,
  patient,
  pharmacy,
  selectedSlot,
  serviceState,
  serviceKey = GREYMATTER_SERVICE_KEY,
}: {
  answers: Record<string, string>;
  insurance: BookingIntentInsurance;
  patient: IntakeDraftData;
  pharmacy: BookingIntentPharmacy;
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
    selectedPharmacy: {
      name: pharmacy.name.trim(),
      address: pharmacy.address.trim(),
      phone: pharmacy.phone.trim(),
      fax: pharmacy.fax.trim(),
      ncpdpId: pharmacy.ncpdpId.trim(),
    },
    selectedSlot: {
      start: selectedSlot.start,
      end: selectedSlot.end,
      providerGuid: selectedSlot.providerGuid?.trim() ?? "",
      providerName: selectedSlot.provider?.trim() ?? "",
    },
    insuranceDetails: {
      memberId: insurance.insurance_member_id.trim(),
      planName: insurance.insurance_plan_name.trim(),
      payerId: insurance.payer_identification.trim(),
      coverageType: insurance.cover_type.trim(),
    },
  };
}
