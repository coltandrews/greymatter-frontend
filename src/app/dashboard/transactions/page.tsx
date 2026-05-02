import { DashboardShell } from "../DashboardShell";
import { TransactionsPanel } from "../TransactionsPanel";
import { requireDashboardAccess } from "../dashboardAccess";

export default async function TransactionsPage() {
  const { role, user } = await requireDashboardAccess();

  return (
    <DashboardShell
      role={role}
      currentPage="transactions"
      title="Transactions"
      subtitle="Patient payment status and Stripe references."
      email={user.email ?? user.id}
    >
      <TransactionsPanel />
    </DashboardShell>
  );
}
