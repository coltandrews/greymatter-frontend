import { DashboardShell } from "../DashboardShell";
import { MedicationRequestsPanel } from "../MedicationRequestsPanel";
import { requireDashboardAccess } from "../dashboardAccess";
import styles from "../dashboard.module.css";

export default async function AppointmentsPage() {
  const { role, user } = await requireDashboardAccess();

  return (
    <DashboardShell
      role={role}
      currentPage="appointments"
      title="Medication Requests"
      subtitle="Review patient intake, payment, ID, shipping, and provider handoff status."
      email={user.email ?? user.id}
    >
      <div className={styles.appointmentsStack}>
        <section className={styles.workspaceCard}>
          <MedicationRequestsPanel />
        </section>
      </div>
    </DashboardShell>
  );
}
