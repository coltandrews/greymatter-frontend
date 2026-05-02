import { BookingQueuePanel } from "../BookingQueuePanel";
import { DashboardShell } from "../DashboardShell";
import { requireDashboardAccess } from "../dashboardAccess";

export default async function BookingQueuePage() {
  const { role, user } = await requireDashboardAccess();

  return (
    <DashboardShell
      role={role}
      currentPage="booking-queue"
      title="Booking Queue"
      subtitle="Active payment and provider booking requests."
      email={user.email ?? user.id}
    >
      <BookingQueuePanel />
    </DashboardShell>
  );
}
