import { createClient } from "@/lib/supabase/server";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { patientWelcomeName } from "@/lib/patientDisplayName";
import { PatientTopBar } from "../PatientTopBar";
import { HubAppointments } from "./HubAppointments";
import styles from "./hub.module.css";

export default async function HubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [
    { data: rows, error },
    { data: bookingRows, error: bookingError },
    { data: profile },
    { data: draftRow },
  ] = await Promise.all([
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
      supabase
        .from("profiles")
        .select("demographics")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("intake_drafts")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle(),
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
  const forWelcome = mergeIntakeAndProfileDemographics(
    draftRow?.data as IntakeDraftData | undefined,
    profile?.demographics as IntakeDraftData | undefined,
  );

  return (
    <>
      <PatientTopBar
        welcomeName={patientWelcomeName(user, forWelcome)}
        email={user.email ?? user.id}
      />
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <h1>Patient hub</h1>
        </header>

        <div className={styles.stack}>
          <section className={styles.panel} aria-labelledby="appointments-title">
            <div className={styles.panelHeaderRow}>
              <h2 id="appointments-title" className={styles.panelTitle}>
                Medications
              </h2>
            </div>

            <HubAppointments
              initial={appointments}
              initialBookingIntents={bookingIntents}
              serverLoadError={error?.message ?? bookingError?.message ?? null}
            />
          </section>
        </div>
      </main>
    </>
  );
}
