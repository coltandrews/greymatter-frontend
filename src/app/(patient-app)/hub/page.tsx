import { createClient } from "@/lib/supabase/server";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { patientWelcomeName } from "@/lib/patientDisplayName";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";
import { HubAppointments } from "./HubAppointments";
import { HubMedications } from "./HubMedications";
import styles from "./hub.module.css";

function patientInitials(name: string, email: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts[0]) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

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
  const welcomeName = patientWelcomeName(user, forWelcome);
  const email = user.email ?? user.id;

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar} aria-label="Patient navigation">
        <div className={styles.sidebarBrand}>
          <img
            src="/brand/logo-horizontal.svg"
            alt="Greymatter MD"
            className={styles.sidebarLogo}
          />
        </div>

        <div className={styles.sidebarUser}>
          <div className={styles.sidebarAvatar} aria-hidden="true">
            {patientInitials(welcomeName, email)}
          </div>
          <div className={styles.sidebarUserText}>
            <p>{welcomeName}</p>
            <span title={email}>{email}</span>
          </div>
        </div>

        <nav className={styles.sidebarNav} aria-label="Patient hub sections">
          <a href="#overview" className={styles.sidebarNavLink}>
            Overview
          </a>
          <a href="#my-medications" className={styles.sidebarNavLink}>
            My medications
          </a>
          <a href="#new-medication" className={styles.sidebarNavLink}>
            Select new medication
          </a>
          <Link href="/account" className={styles.sidebarNavLink}>
            Account
          </Link>
        </nav>

        <div className={styles.sidebarFooter}>
          <SignOutButton noMargin />
        </div>
      </aside>

      <section className={styles.content}>
        <header id="overview" className={styles.pageHeader}>
          <div>
            <p className={styles.kicker}>Patient portal</p>
            <h1>Patient Hub</h1>
            <p>Track provider review, payment, and medication request status.</p>
          </div>
        </header>

        <div className={styles.dashboardGrid}>
          <section
            id="my-medications"
            className={`${styles.panel} ${styles.primaryPanel}`}
            aria-labelledby="medications-title"
          >
            <HubMedications
              appointments={appointments}
              bookingIntents={bookingIntents}
              serverLoadError={error?.message ?? bookingError?.message ?? null}
            />
          </section>

          <section
            id="new-medication"
            className={`${styles.panel} ${styles.selectorPanel}`}
            aria-labelledby="new-medication-title"
          >
            <div className={styles.panelHeader}>
              <p className={styles.kicker}>New request</p>
              <h2 id="new-medication-title" className={styles.panelTitle}>
                Select new medication
              </h2>
              <p className={styles.panelSubtitle}>
                Start a new provider-reviewed medication request when you are ready.
              </p>
            </div>

            <div className={styles.medicationSelectCard}>
              <div>
                <p className={styles.medicationSelectName}>GLP-1 Subscription</p>
                <p className={styles.medicationSelectText}>
                  Complete intake, pay securely, and send your request to the provider network
                  for review.
                </p>
              </div>
              <Link
                href="/?new_medication=1"
                aria-label="Start a GLP-1 subscription request"
                className={`${styles.scheduleNewBtn} ${styles.scheduleNewLink}`}
              >
                Start request
              </Link>
            </div>
          </section>
        </div>

        <section className={styles.panel} aria-labelledby="appointments-title">
          <div className={styles.panelHeaderRow}>
            <div>
              <h2 id="appointments-title" className={styles.panelTitle}>
                Request history
              </h2>
              <p className={styles.panelSubtitle}>
                Review payment, provider handoff, and next-step status for each medication
                request.
              </p>
            </div>
          </div>

          <HubAppointments
            initial={appointments}
            initialBookingIntents={bookingIntents}
            serverLoadError={error?.message ?? bookingError?.message ?? null}
          />
        </section>
      </section>
    </main>
  );
}
