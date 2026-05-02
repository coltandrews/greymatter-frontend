import { bookingOperationsSummary } from "@/lib/dashboard/operationsSummary";
import { DashboardShell } from "./DashboardShell";
import { OperationsSummaryCards } from "./OperationsSummaryCards";
import { requireDashboardAccess } from "./dashboardAccess";

export default async function DashboardPage() {
  const { role, supabase, user } = await requireDashboardAccess();
  const { data: operationsRows, error } = await supabase
    .from("booking_intents")
    .select("payment_status, booking_status, ola_status");
  const operationsSummary = bookingOperationsSummary(operationsRows ?? []);

  return (
    <DashboardShell
      role={role}
      currentPage="overview"
      title="Admin portal"
      subtitle="A focused view of booking status, payment progress, and staff follow-up needs."
      email={user.email ?? user.id}
    >
      {error ? (
        <p role="alert" style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>
          {error.message}
        </p>
      ) : null}
      <OperationsSummaryCards summary={operationsSummary} />
    </DashboardShell>
  );
}
