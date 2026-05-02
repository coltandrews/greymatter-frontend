import { DashboardShell } from "../DashboardShell";
import { ConfigHealthPanel } from "../ConfigHealthPanel";
import { requireDashboardAccess } from "../dashboardAccess";

export default async function AppHealthPage() {
  const { role, user } = await requireDashboardAccess({ adminOnly: true });

  return (
    <DashboardShell
      role={role}
      currentPage="app-health"
      title="App Health"
      subtitle="Admin-only checks for backend configuration and service readiness."
      email={user.email ?? user.id}
    >
      <ConfigHealthPanel />
    </DashboardShell>
  );
}
