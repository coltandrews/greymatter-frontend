import { DashboardShell } from "../DashboardShell";
import { StaffRecoveryPanel } from "../StaffRecoveryPanel";
import { requireDashboardAccess } from "../dashboardAccess";

export default async function BookingIssuesPage() {
  const { role, supabase, user } = await requireDashboardAccess();
  const { data: recoveryRows, error } = await supabase
    .from("booking_intents")
    .select("id, user_id, payment_status, booking_status, ola_status, service_state, selected_slot, selected_pharmacy, vendor_metadata, ola_order_guid, ola_redirect_url, failure_reason, created_at, updated_at")
    .eq("payment_status", "paid")
    .eq("booking_status", "needs_review")
    .order("updated_at", { ascending: false });

  return (
    <DashboardShell
      role={role}
      currentPage="booking-issues"
      title="Booking issues"
      subtitle="Paid bookings that need staff help before provider confirmation."
      email={user.email ?? user.id}
    >
      {error ? (
        <p role="alert" style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>
          {error.message}
        </p>
      ) : null}
      <StaffRecoveryPanel
        initialBookings={(recoveryRows ?? []).map((row) => ({
          id: row.id,
          user_id: row.user_id,
          payment_status: row.payment_status,
          booking_status: row.booking_status,
          ola_status: row.ola_status,
          service_state: row.service_state,
          selected_slot: row.selected_slot,
          selected_pharmacy: row.selected_pharmacy,
          vendor_metadata: row.vendor_metadata,
          ola_order_guid: row.ola_order_guid,
          ola_redirect_url: row.ola_redirect_url,
          failure_reason: row.failure_reason,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }))}
      />
    </DashboardShell>
  );
}
