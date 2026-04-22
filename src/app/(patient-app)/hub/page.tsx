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
      <div className={styles.welcome}>
        <h1>Your dashboard</h1>
        <p>
          Schedule visits, track what&apos;s in progress, and view prescriptions. Click your email
          above anytime to update your account.
        </p>
      </div>

      <div className={styles.ctaRow}>
        <button type="button" className={styles.ctaPrimary} disabled>
          <span className={styles.ctaLabel}>Schedule a visit</span>
          <span className={styles.ctaHint}>
            Book a telehealth appointment when your provider&apos;s calendar is connected.
          </span>
        </button>
        <button type="button" className={styles.ctaSecondary} disabled>
          <span className={styles.ctaLabel}>Request a refill</span>
          <span className={styles.ctaHint}>
            Ask your care team about a prescription refill (coming soon).
          </span>
        </button>
      </div>

      <div className={styles.mainGrid}>
        <section className={styles.card} aria-labelledby="visits-heading">
          <div className={styles.cardHeader}>
            <div>
              <h2 id="visits-heading" className={styles.cardTitle}>
                Upcoming &amp; in progress
              </h2>
              <p className={styles.cardSubtitle}>
                Visits and care requests you&apos;ve started or scheduled.
              </p>
            </div>
            {visitCount > 0 ? (
              <span className={styles.badge}>
                {visitCount} {visitCount === 1 ? "item" : "items"}
              </span>
            ) : null}
          </div>

          {error ? <p className={styles.error}>{error.message}</p> : null}

          {!error && (!rows || rows.length === 0) ? (
            <p className={styles.emptyState}>
              Nothing scheduled yet. Use <strong>Schedule a visit</strong> when it&apos;s available
              to add your first appointment here.
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

        <section className={styles.card} aria-labelledby="rx-heading">
          <div className={styles.cardHeader}>
            <div>
              <h2 id="rx-heading" className={styles.cardTitle}>
                Prescriptions
              </h2>
              <p className={styles.cardSubtitle}>
                Active medications and the pharmacy on file for your care.
              </p>
            </div>
          </div>
          <div className={styles.prescriptionStub}>
            <div className={styles.rxMark} aria-hidden>
              Rx
            </div>
            Your prescription list will appear here once we sync with your provider and pharmacy.
          </div>
        </section>
      </div>
    </main>
  );
}
