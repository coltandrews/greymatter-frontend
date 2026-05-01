import type { BookingQueueRow } from "@/lib/api/admin";
import { hubBookingIntentStatusView } from "@/lib/scheduling/hubBookingStatus";

export type BookingQueueStatusView = {
  label: string;
  color: string;
  background: string;
};

const toneStyles = {
  confirmed: { color: "#166534", background: "#dcfce7" },
  pending: { color: "#1d4ed8", background: "#dbeafe" },
  action: { color: "#92400e", background: "#fef3c7" },
  review: { color: "#9a3412", background: "#ffedd5" },
  cancelled: { color: "#475569", background: "#f1f5f9" },
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
  if (!row.slotStart) {
    return provider;
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
