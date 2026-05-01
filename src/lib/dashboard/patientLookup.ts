import type { PatientLookupPatient } from "@/lib/api/admin";

export function patientLookupSummary(patient: PatientLookupPatient): string {
  return [
    patient.email,
    patient.serviceState ? `State ${patient.serviceState}` : null,
    patient.latestSubmission?.status
      ? `Intake ${patient.latestSubmission.status.replace("_", " ")}`
      : "No submission",
  ].filter(Boolean).join(" · ");
}

export function patientLookupActivitySummary(patient: PatientLookupPatient): string {
  const bookingCount = patient.bookings.length;
  const appointmentCount = patient.appointments.length;
  return `${bookingCount} booking${bookingCount === 1 ? "" : "s"} · ${appointmentCount} appointment${appointmentCount === 1 ? "" : "s"}`;
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
