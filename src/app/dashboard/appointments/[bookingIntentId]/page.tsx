import { DashboardShell } from "../../DashboardShell";
import { MedicationRequestDetail } from "../../MedicationRequestDetail";
import { requireDashboardAccess } from "../../dashboardAccess";

type Props = {
  params: Promise<{
    bookingIntentId: string;
  }>;
};

export default async function MedicationRequestDetailPage({ params }: Props) {
  const { bookingIntentId } = await params;
  const { role, user } = await requireDashboardAccess();

  return (
    <DashboardShell
      role={role}
      currentPage="appointments"
      title="Medication Request"
      subtitle="Patient intake, payment, ID, shipping, and provider handoff details."
      email={user.email ?? user.id}
    >
      <MedicationRequestDetail bookingIntentId={bookingIntentId} />
    </DashboardShell>
  );
}
