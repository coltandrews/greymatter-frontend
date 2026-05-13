import type { BookingQueueRow } from "@/lib/api/admin";
import { hubBookingIntentStatusView } from "@/lib/scheduling/hubBookingStatus";
import { treatmentByKey } from "@/lib/treatments";

export type BookingQueueStatusView = {
  label: string;
  color: string;
  background: string;
};

const toneStyles = {
  confirmed: { color: "#86efac", background: "rgba(22, 163, 74, 0.16)" },
  pending: { color: "#8ec5ff", background: "rgba(52, 135, 237, 0.16)" },
  action: { color: "#fdba74", background: "rgba(180, 83, 9, 0.16)" },
  review: { color: "#fdba74", background: "rgba(180, 83, 9, 0.16)" },
  cancelled: { color: "#b8b8b8", background: "#242424" },
};

export function bookingQueueStatusView(row: BookingQueueRow): BookingQueueStatusView {
  const view = hubBookingIntentStatusView({
    booking_status: row.bookingStatus,
    payment_status: row.paymentStatus,
    ola_status: row.olaStatus,
  });
  return {
    label: view.label,
    ...toneStyles[view.tone],
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
