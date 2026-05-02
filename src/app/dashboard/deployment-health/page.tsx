import { DashboardShell } from "../DashboardShell";
import { ConfigHealthPanel } from "../ConfigHealthPanel";
import { requireDashboardAccess } from "../dashboardAccess";

export default async function DeploymentHealthPage() {
  const { role, user } = await requireDashboardAccess({ adminOnly: true });

  return (
    <DashboardShell
      role={role}
      currentPage="deployment-health"
      title="Deployment health"
      subtitle="Admin-only backend configuration checks."
      email={user.email ?? user.id}
    >
      <ConfigHealthPanel />
    </DashboardShell>
  );
}
