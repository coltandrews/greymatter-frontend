import type { BookingQueueRow } from "@/lib/api/admin";
import { treatmentByKey } from "@/lib/treatments";
import {
  medicationRequestStatusView,
  medicationRequestToneStyles,
} from "./medicationRequests";

export type BookingQueueStatusView = {
  label: string;
  color: string;
  background: string;
};

export function bookingQueueStatusView(row: BookingQueueRow): BookingQueueStatusView {
  const view = medicationRequestStatusView({
    bookingStatus: row.bookingStatus,
    paymentStatus: row.paymentStatus,
    olaStatus: row.olaStatus,
    failureReason: row.failureReason,
    hasNextSteps: row.hasNextSteps,
  });
  return {
    label: view.label,
    ...medicationRequestToneStyles[view.tone],
  };
}

export function bookingQueuePatientLabel(row: BookingQueueRow): string {
  return row.patientEmail ? `${row.patientName} · ${row.patientEmail}` : row.patientName;
}

export function bookingQueueSlotLabel(row: BookingQueueRow): string {
  const provider = row.providerName?.trim() || "Provider pending";
  if (provider === "Provider pending") {
    return row.serviceState ? `Provider review · ${row.serviceState}` : "Provider review";
  }
  if (!row.slotStart) {
    return provider;
  }
  if (row.slotStart === "2030-01-01T15:00:00.000Z") {
    return row.serviceState ? `${provider} · ${row.serviceState}` : provider;
  }
  const date = new Date(row.slotStart);
  if (Number.isNaN(date.getTime())) {
    return `${provider} · ${row.slotStart}`;
  }
  return `${provider} · ${date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

export function bookingQueueTreatmentLabel(row: BookingQueueRow): string {
  const treatment = treatmentByKey(row.treatmentKey);
  if (!treatment) {
    return row.treatmentKey?.trim() || "Treatment not selected";
  }
  const answerText =
    row.treatmentAnswerCount > 0
      ? ` · ${row.treatmentAnswerCount} med Q&A`
      : "";
  return `${treatment.name}${answerText}`;
}

export function bookingQueuePharmacyLabel(row: BookingQueueRow): string {
  if (!row.pharmacyName && !row.pharmacyNcpdpId) {
    return "Pharmacy pending";
  }
  return [row.pharmacyName, row.pharmacyNcpdpId ? `NCPDP ${row.pharmacyNcpdpId}` : null]
    .filter(Boolean)
    .join(" · ");
}

export function bookingQueueReference(row: BookingQueueRow): string {
  return row.olaOrderGuid || row.id;
}
