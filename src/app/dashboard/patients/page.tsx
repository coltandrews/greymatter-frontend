import { DashboardShell } from "../DashboardShell";
import { PatientLookupPanel } from "../PatientLookupPanel";
import { requireDashboardAccess } from "../dashboardAccess";

export default async function PatientsPage() {
  const { role, user } = await requireDashboardAccess();

  return (
    <DashboardShell
      role={role}
      currentPage="patients"
      title="Patients"
      subtitle="Find patient records, bookings, appointments, and audit notes."
      email={user.email ?? user.id}
    >
      <PatientLookupPanel />
    </DashboardShell>
  );
}
