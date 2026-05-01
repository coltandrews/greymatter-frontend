export type StaffRecoveryBooking = {
  id: string;
  user_id: string;
  payment_status: string;
  booking_status: string;
  ola_status: string;
  selected_slot: unknown;
  failure_reason: string | null;
  updated_at: string;
  created_at: string;
};

function slotRecord(selectedSlot: unknown): Record<string, unknown> {
  return selectedSlot && typeof selectedSlot === "object"
    ? (selectedSlot as Record<string, unknown>)
    : {};
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
