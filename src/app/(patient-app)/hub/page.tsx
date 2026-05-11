import { createClient } from "@/lib/supabase/server";
import { HubAppointments } from "./HubAppointments";
import { HubMedications } from "./HubMedications";
import styles from "./hub.module.css";

export default async function HubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: rows, error }, { data: bookingRows, error: bookingError }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, status, starts_at, created_at, updated_at, provider_name, ola_redirect_url, ola_popup_message, ola_order_guid")
        .eq("user_id", user.id)
        .order("starts_at", { ascending: true }),
      supabase
        .from("booking_intents")
        .select("id, booking_status, payment_status, ola_status, selected_slot, intake_data, stripe_checkout_session_id, created_at, updated_at, ola_redirect_url, ola_popup_message, ola_order_guid")
        .eq("user_id", user.id)
        .neq("booking_status", "draft")
        .order("created_at", { ascending: false }),
    ]);

  const appointments = (rows ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    starts_at: r.starts_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    provider_name: r.provider_name,
    ola_redirect_url: r.ola_redirect_url,
    ola_popup_message: r.ola_popup_message,
    ola_order_guid: r.ola_order_guid,
  }));
  const bookingIntents = (bookingRows ?? []).map((r) => ({
    id: r.id,
    booking_status: r.booking_status,
    payment_status: r.payment_status,
    ola_status: r.ola_status,
    selected_slot: r.selected_slot,
    intake_data: r.intake_data,
    stripe_checkout_session_id: r.stripe_checkout_session_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    ola_redirect_url: r.ola_redirect_url,
    ola_popup_message: r.ola_popup_message,
    ola_order_guid: r.ola_order_guid,
  }));

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <h1>Patient Hub</h1>
      </header>

      <div className={styles.stack}>
        <section className={styles.panel} aria-labelledby="appointments-title">
          <div className={styles.panelHeaderRow}>
            <h2 id="appointments-title" className={styles.panelTitle}>
              Medication Requests
            </h2>
          </div>

          <HubAppointments
            initial={appointments}
            initialBookingIntents={bookingIntents}
            serverLoadError={error?.message ?? bookingError?.message ?? null}
          />
        </section>

        <section className={styles.panel} aria-labelledby="medications-title">
          <HubMedications
            appointments={appointments}
            bookingIntents={bookingIntents}
            serverLoadError={error?.message ?? bookingError?.message ?? null}
          />
        </section>
      </div>
    </main>
  );
}
