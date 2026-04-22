import { createClient } from "@/lib/supabase/server";
import styles from "./hub.module.css";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default async function HubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: rows, error } = await supabase
    .from("submissions")
    .select("id, status, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

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
            <button
              type="button"
              className={styles.scheduleNewBtn}
              disabled
              title="Uses provider availability from Ola when your integration is live."
            >
              Schedule new appointment
            </button>
          </div>

          {error ? <p className={styles.error}>{error.message}</p> : null}

          {!error && visitCount > 0 ? (
            <div className={styles.listToolbar}>
              <p className={styles.listHeading}>Your list</p>
              <span className={styles.badge}>
                {visitCount} {visitCount === 1 ? "entry" : "entries"}
              </span>
            </div>
          ) : null}

          {!error && (!rows || rows.length === 0) ? (
            <p className={styles.emptyState}>
              You don&apos;t have any appointments here yet. When scheduling is connected to Ola,
              use <strong>Schedule new appointment</strong> to add one—they&apos;ll show up here.
            </p>
          ) : null}

          {!error && rows && rows.length > 0 ? (
            <ul className={styles.visitList}>
              {rows.map((r) => (
                <li key={r.id} className={styles.visitItem}>
                  <div className={styles.visitMeta}>
                    <span className={styles.statusPill}>{r.status.replace("_", " ")}</span>
                    <span className={styles.visitDate}>Updated {formatWhen(r.updated_at)}</span>
                  </div>
                  <p className={styles.visitFoot}>Started {formatWhen(r.created_at)}</p>
                </li>
              ))}
            </ul>
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
