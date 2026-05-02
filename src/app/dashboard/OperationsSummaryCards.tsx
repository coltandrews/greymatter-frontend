import type { BookingOperationsSummary } from "@/lib/dashboard/operationsSummary";
import styles from "./dashboard.module.css";

const cards: {
  key: keyof BookingOperationsSummary;
  label: string;
  hint: string;
  accent: string;
}[] = [
  {
    key: "paymentPending",
    label: "Payment Pending",
    hint: "Checkout started, not paid yet",
    accent: "#2563eb",
  },
  {
    key: "olaPending",
    label: "Provider Pending",
    hint: "Payment complete, provider booking in progress",
    accent: "#7c3aed",
  },
  {
    key: "booked",
    label: "Booked",
    hint: "Payment and Ola booking complete",
    accent: "#15803d",
  },
  {
    key: "needsReview",
    label: "Needs Help",
    hint: "Paid but not automatically booked",
    accent: "#c2410c",
  },
];

export function OperationsSummaryCards({
  summary,
}: {
  summary: BookingOperationsSummary;
}) {
  const total =
    summary.paymentPending +
    summary.olaPending +
    summary.booked +
    summary.needsReview;
  const open = summary.paymentPending + summary.olaPending + summary.needsReview;

  return (
    <section aria-labelledby="operations-title">
      <div className={styles.overviewHero}>
        <div className={styles.overviewPrimary}>
          <p className={styles.overviewEyebrow}>Operations snapshot</p>
          <h2 id="operations-title" className={styles.overviewTitle}>
            {open} active booking {open === 1 ? "request" : "requests"}
          </h2>
          <p className={styles.overviewText}>
            Track where each paid consultation is in the payment, provider booking,
            and staff follow-up flow.
          </p>
        </div>
        <div className={styles.overviewSide}>
          <div className={styles.overviewStat}>
            <p className={styles.overviewStatLabel}>Total tracked</p>
            <p className={styles.overviewStatValue}>{total}</p>
          </div>
          <div className={styles.overviewStat}>
            <p className={styles.overviewStatLabel}>Needs staff help</p>
            <p className={styles.overviewStatValue}>{summary.needsReview}</p>
          </div>
        </div>
      </div>
      <div className={styles.cardGrid}>
        {cards.map((card) => (
          <div
            key={card.key}
            className={styles.metricCard}
          >
            <div className={styles.metricTop}>
              <p className={styles.metricLabel}>{card.label}</p>
              <span
                className={styles.metricDot}
                style={{ background: card.accent }}
                aria-hidden="true"
              />
            </div>
            <p className={styles.metricValue}>
              {summary[card.key]}
            </p>
            <p className={styles.metricHint}>{card.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
