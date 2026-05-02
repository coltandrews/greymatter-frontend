import { DashboardShell } from "../DashboardShell";
import { PatientLookupPanel } from "../PatientLookupPanel";
import { requireDashboardAccess } from "../dashboardAccess";

type PatientsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
  const { role, user } = await requireDashboardAccess();
  const params = searchParams ? await searchParams : {};

  return (
    <DashboardShell
      role={role}
      currentPage="patients"
      title="Patients"
      subtitle="Find patient records, bookings, appointments, and audit notes."
      email={user.email ?? user.id}
    >
      <PatientLookupPanel
        initialPatientId={firstSearchValue(params.patient) || null}
        initialQuery={firstSearchValue(params.q)}
      />
    </DashboardShell>
  );
}
