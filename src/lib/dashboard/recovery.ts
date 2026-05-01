export type StaffRecoveryBooking = {
  id: string;
  user_id: string;
  payment_status: string;
  booking_status: string;
  ola_status: string;
  service_state: string | null;
  selected_slot: unknown;
  selected_pharmacy: unknown;
  vendor_metadata: unknown;
  ola_order_guid: string | null;
  ola_redirect_url: string | null;
  failure_reason: string | null;
  updated_at: string;
  created_at: string;
};

export type RecoveryDetail = {
  label: string;
  value: string;
  mono?: boolean;
};

function slotRecord(selectedSlot: unknown): Record<string, unknown> {
  return selectedSlot && typeof selectedSlot === "object"
    ? (selectedSlot as Record<string, unknown>)
    : {};
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringValue(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

export function recoveryBookingTitle(row: StaffRecoveryBooking): string {
  const slot = slotRecord(row.selected_slot);
  const providerName = typeof slot.providerName === "string" ? slot.providerName.trim() : "";
  return providerName || "Provider pending";
}

export function recoveryBookingTime(row: StaffRecoveryBooking): string {
  const slot = slotRecord(row.selected_slot);
  const start = typeof slot.start === "string" && slot.start.trim()
    ? slot.start
    : row.updated_at;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) {
    return start;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function canRetryOlaBooking(row: StaffRecoveryBooking): boolean {
  return row.payment_status === "paid" && row.booking_status === "needs_review";
}

export function recoveryPharmacySummary(row: StaffRecoveryBooking): string {
  const pharmacy = asRecord(row.selected_pharmacy);
  const name = stringValue(pharmacy, ["name", "pharmacy_name"]);
  const ncpdp = stringValue(pharmacy, ["ncpdpId", "pharmacy_ncpdp_id"]);
  const phone = stringValue(pharmacy, ["phone", "pharmacy_phone"]);
  const parts = [
    name,
    ncpdp ? `NCPDP ${ncpdp}` : null,
    phone ? `Phone ${phone}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Pharmacy not selected";
}

export function recoveryStateSummary(row: StaffRecoveryBooking): string {
  return [
    `Payment ${row.payment_status}`,
    `Booking ${row.booking_status}`,
    `Ola ${row.ola_status}`,
    row.service_state ? `State ${row.service_state}` : null,
  ].filter(Boolean).join(" · ");
}

export function recoveryDiagnosticDetails(row: StaffRecoveryBooking): RecoveryDetail[] {
  const vendor = asRecord(row.vendor_metadata);
  const details: RecoveryDetail[] = [];
  const vendorMessage = stringValue(vendor, ["message", "error", "detail"]);
  const vendorStatus = stringValue(vendor, ["status", "statusCode", "code"]);

  details.push({
    label: "Failure reason",
    value: row.failure_reason?.trim() || "Ola booking did not complete.",
  });
  if (vendorMessage && vendorMessage !== row.failure_reason) {
    details.push({ label: "Ola message", value: vendorMessage });
  }
  if (vendorStatus) {
    details.push({ label: "Ola status", value: vendorStatus });
  }
  if (row.ola_order_guid) {
    details.push({ label: "Ola order", value: row.ola_order_guid, mono: true });
  }
  details.push({ label: "Booking ID", value: row.id, mono: true });
  details.push({ label: "Patient ID", value: row.user_id, mono: true });
  return details;
}
