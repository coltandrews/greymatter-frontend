import { DashboardShell } from "../DashboardShell";
import { StaffRecoveryPanel } from "../StaffRecoveryPanel";
import { SubmissionsPanel } from "../SubmissionsPanel";
import { requireDashboardAccess } from "../dashboardAccess";
import styles from "../dashboard.module.css";

export default async function AppointmentsPage() {
  const { role, supabase, user } = await requireDashboardAccess();
  const [
    { data: submissions, error: submissionsError },
    { data: recoveryRows, error: recoveryError },
  ] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, user_id, status, created_at, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("booking_intents")
      .select("id, user_id, payment_status, booking_status, ola_status, service_state, selected_slot, selected_pharmacy, vendor_metadata, ola_order_guid, ola_redirect_url, failure_reason, created_at, updated_at")
      .eq("payment_status", "paid")
      .eq("booking_status", "needs_review")
      .order("updated_at", { ascending: false }),
  ]);

  return (
    <DashboardShell
      role={role}
      currentPage="appointments"
      title="Appointments"
      subtitle="Queue, submissions, and booking issues."
      email={user.email ?? user.id}
    >
      <div className={styles.appointmentsStack}>
        <section className={styles.workspaceCard}>
          <SubmissionsPanel
            initialSubmissions={submissions ?? []}
            submissionsError={submissionsError?.message ?? null}
          />
        </section>

        <section className={styles.workspaceCard}>
          {recoveryError ? (
            <p role="alert" className={styles.inlineError}>
              {recoveryError.message}
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
        </section>
      </div>
    </DashboardShell>
  );
}
