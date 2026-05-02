import { DashboardShell } from "../DashboardShell";
import { IntakeQuestionsPanel } from "../IntakeQuestionsPanel";
import { requireDashboardAccess } from "../dashboardAccess";

export default async function IntakePage() {
  const { role, user } = await requireDashboardAccess({ adminOnly: true });

  return (
    <DashboardShell
      role={role}
      currentPage="intake"
      title="Intake"
      subtitle="Control the pre-signup questions patients answer before account creation."
      email={user.email ?? user.id}
    >
      <IntakeQuestionsPanel />
    </DashboardShell>
  );
}
