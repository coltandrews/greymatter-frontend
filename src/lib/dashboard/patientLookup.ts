import type { PatientLookupPatient } from "@/lib/api/admin";

export function patientLookupSummary(patient: PatientLookupPatient): string {
  return [
    patient.email,
    patient.serviceState ? `State ${patient.serviceState}` : null,
    patient.latestSubmission?.status
      ? `Intake form ${patient.latestSubmission.status.replace("_", " ")}`
      : "No intake form",
  ].filter(Boolean).join(" · ");
}

export function patientLookupActivitySummary(patient: PatientLookupPatient): string {
  const bookingCount = patient.bookings.length;
  const appointmentCount = patient.appointments.length;
  return `${bookingCount} booking request${bookingCount === 1 ? "" : "s"} · ${appointmentCount} provider appt${appointmentCount === 1 ? "" : "s"}`;
}

export function patientLookupAppointmentLabel(
  appointment: PatientLookupPatient["appointments"][number],
): string {
  const provider = appointment.providerName?.trim() || "Provider pending";
  const date = new Date(appointment.startsAt);
  const when = Number.isNaN(date.getTime())
    ? appointment.startsAt
    : date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  return `${provider} · ${when}`;
}

export function patientLookupReference(patient: PatientLookupPatient): string {
  return patient.email || patient.userId;
}
