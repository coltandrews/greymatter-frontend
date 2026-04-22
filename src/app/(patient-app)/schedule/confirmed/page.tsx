import Link from "next/link";
import styles from "./confirmed.module.css";

type Props = {
  searchParams: Promise<{ date?: string; t?: string }>;
};

export default async function ScheduleConfirmedPage({ searchParams }: Props) {
  const sp = await searchParams;
  const dateStr = typeof sp.date === "string" ? sp.date : null;
  const slotIso = typeof sp.t === "string" ? sp.t : null;

  let summary = "Your appointment details are saved.";
  if (dateStr && slotIso) {
    try {
      const datePart = new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const timePart = new Date(slotIso).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      summary = `${datePart} at ${timePart}`;
    } catch {
      /* keep default */
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden>
          ✓
        </div>
        <h1 className={styles.title}>You&apos;re all set</h1>
        <p className={styles.lead}>Your appointment is booked.</p>
        <p className={styles.summary}>{summary}</p>
        <p className={styles.hint}>
          We&apos;ll follow up with next steps. You can always return to your hub to see visits and
          updates.
        </p>
        <Link href="/hub" className={styles.btn}>
          Back to Patient Hub
        </Link>
      </div>
    </main>
  );
}
