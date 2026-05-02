import type { AuditEvent } from "@/lib/api/admin";

const actionLabels: Record<string, string> = {
  booking_intent_created: "Booking request started",
  stripe_checkout_created: "Checkout created",
  stripe_payment_ola_booking_completed: "Payment and provider handoff complete",
  stripe_payment_ola_booking_needs_review: "Payment received, provider handoff needs review",
  ola_retry_succeeded: "Provider handoff retry succeeded",
  ola_retry_failed: "Provider handoff retry failed",
  staff_note_added: "Staff note",
};

export function auditEventLabel(event: Pick<AuditEvent, "action">): string {
  return actionLabels[event.action] ?? event.action.replaceAll("_", " ");
}

export function auditEventSummary(event: AuditEvent): string {
  if (event.note?.trim()) {
    return event.note.trim();
  }
  if (event.action === "staff_note_added") {
    return "Staff note added.";
  }
  return auditEventLabel(event);
}

export function auditEventWhen(event: Pick<AuditEvent, "createdAt">): string {
  const date = new Date(event.createdAt);
  if (Number.isNaN(date.getTime())) {
    return event.createdAt;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function auditTargetLabel(target: {
  patientUserId?: string | null;
  bookingIntentId?: string | null;
  appointmentId?: string | null;
}): string {
  if (target.bookingIntentId) {
    return "booking request";
  }
  if (target.appointmentId) {
    return "provider appointment";
  }
  return "patient";
}
