import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
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

  const { data: rows, error } = await supabase
    .from("appointments")
    .select("id, status, starts_at, created_at, updated_at, provider_name")
    .eq("user_id", user.id)
    .order("starts_at", { ascending: true });

  const visitCount = rows?.length ?? 0;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <h1>Patient Hub</h1>
      </header>

      <div className={styles.stack}>
        <section className={styles.panel} aria-labelledby="appointments-title">
          <div className={styles.panelHeaderRow}>
            <h2 id="appointments-title" className={styles.panelTitle}>
              Appointments
            </h2>
            <Link href="/schedule" className={`${styles.scheduleNewBtn} ${styles.scheduleNewLink}`}>
              + Schedule Appointment
            </Link>
          </div>

          {error ? <p className={styles.error}>{error.message}</p> : null}

          {!error && visitCount > 0 ? (
            <div className={styles.listToolbar}>
              <p className={styles.listHeading}>Your list</p>
              <span className={styles.badge}>
                {visitCount} {visitCount === 1 ? "appointment" : "appointments"}
              </span>
            </div>
          ) : null}

          {!error && (!rows || rows.length === 0) ? (
            <p className={styles.emptyState}>
              You don&apos;t have any appointments here yet. Use{" "}
              <strong>+ Schedule Appointment</strong> to book one—they&apos;ll show up here.
            </p>
          ) : null}

          {!error && rows && rows.length > 0 ? (
            <HubAppointments
              appointments={rows.map((r) => ({
                id: r.id,
                status: r.status,
                starts_at: r.starts_at,
                created_at: r.created_at,
                updated_at: r.updated_at,
                provider_name: r.provider_name,
              }))}
            />
          ) : null}
        </section>

        <section className={styles.panel} aria-labelledby="medications-title">
          <div className={styles.panelHeader}>
            <h2 id="medications-title" className={styles.panelTitle}>
              Medications
            </h2>
          </div>
          <p className={styles.emptyState}>No current prescriptions.</p>
        </section>
      </div>
    </main>
  );
}
