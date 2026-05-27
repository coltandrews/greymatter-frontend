import Link from "next/link";
import {
  medicationRequestAgeLabel,
  medicationRequestLifecycleCounts,
  medicationRequestNeedsAttention,
  medicationRequestPatientName,
  medicationRequestPhoneLast4,
  medicationRequestShippingSummary,
  medicationRequestStatusView,
  medicationRequestToneStyles,
  medicationRequestTreatmentLabel,
} from "@/lib/dashboard/medicationRequests";
import { DashboardShell } from "./DashboardShell";
import { requireDashboardAccess } from "./dashboardAccess";
import styles from "./dashboard.module.css";

type BookingIntentOverviewRow = {
  id: string;
  user_id: string;
  amount_cents: number | null;
  currency: string | null;
  payment_status: string | null;
  booking_status: string | null;
  ola_status: string | null;
  service_state: string | null;
  stripe_checkout_session_id: string | null;
  failure_reason: string | null;
  intake_data: unknown;
  created_at: string;
  updated_at: string;
};

function formatCurrencyCents(amountCents: number, currency: string | null) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "usd",
  }).format(amountCents / 100);
}

function sumAmountCents(rows: BookingIntentOverviewRow[]) {
  return rows.reduce(
    (sum, row) => sum + (typeof row.amount_cents === "number" ? row.amount_cents : 0),
    0,
  );
}

function primaryCurrency(rows: BookingIntentOverviewRow[]) {
  return rows.find((row) => row.currency?.trim())?.currency ?? "usd";
}

function submittedRequests(rows: BookingIntentOverviewRow[]) {
  return rows.filter((row) => row.payment_status === "paid");
}

function stateBreakdown(rows: BookingIntentOverviewRow[]) {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const state = row.service_state || "Unknown";
    acc[state] = (acc[state] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);
}

function treatmentBreakdown(rows: BookingIntentOverviewRow[]) {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const treatment = medicationRequestTreatmentLabel(row.intake_data);
    acc[treatment] = (acc[treatment] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function requestAttentionRows(rows: BookingIntentOverviewRow[]) {
  return rows
    .map((row) => {
      const status = medicationRequestStatusView({
        bookingStatus: row.booking_status,
        paymentStatus: row.payment_status,
        olaStatus: row.ola_status,
        failureReason: row.failure_reason,
      });
      const attention = medicationRequestNeedsAttention({
        status,
        intakeData: row.intake_data,
        updatedAt: row.updated_at,
      });
      return { row, status, attention };
    })
    .filter((item) => item.attention.needsAttention)
    .sort((a, b) => a.status.sortRank - b.status.sortRank);
}

function attentionReasonLabel(reason: string) {
  switch (reason) {
    case "payment_failed":
      return "Payment failed";
    case "provider_handoff_failed":
      return "Provider handoff failed";
    case "missing_id":
      return "ID missing";
    case "missing_shipping":
      return "Shipping missing";
    default:
      return reason.replace(/_/g, " ");
  }
}

export default async function DashboardPage() {
  const { role, supabase, user } = await requireDashboardAccess();
  const { data: bookingRows, error: bookingsError } = await supabase
    .from("booking_intents")
    .select("id, user_id, amount_cents, currency, payment_status, booking_status, ola_status, service_state, stripe_checkout_session_id, failure_reason, intake_data, created_at, updated_at")
    .neq("booking_status", "draft")
    .order("updated_at", { ascending: false });

  const bookings = (bookingRows ?? []) as BookingIntentOverviewRow[];
  const submitted = submittedRequests(bookings);
  const lifecycle = medicationRequestLifecycleCounts(
    bookings.map((row) => ({
      bookingStatus: row.booking_status,
      paymentStatus: row.payment_status,
      olaStatus: row.ola_status,
      failureReason: row.failure_reason,
    })),
  );
  const paidTotal = sumAmountCents(submitted);
  const currency = primaryCurrency(bookings);
  const attentionRows = requestAttentionRows(bookings);
  const visibleAttentionRows = attentionRows.slice(0, 6);
  const treatmentRows = treatmentBreakdown(bookings);
  const stateRows = stateBreakdown(bookings);
  const latestRequests = bookings
    .slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 8);

  return (
    <DashboardShell
      role={role}
      currentPage="overview"
      title="Admin Portal"
      subtitle="Medication request intake, payment, provider handoff, and review status."
      email={user.email ?? user.id}
    >
      {bookingsError ? (
        <p role="alert" className={styles.inlineError}>
          {bookingsError.message}
        </p>
      ) : null}

      <div className={styles.overviewStack}>
        <section className={styles.overviewHeroPanel} aria-labelledby="overview-title">
          <div>
            <p className={styles.overviewEyebrow}>Medication request operations</p>
            <h2 id="overview-title" className={styles.overviewTitle}>
              {attentionRows.length} request exception{attentionRows.length === 1 ? "" : "s"}
            </h2>
            <p className={styles.overviewText}>
              Track intake completion, treatment selection, payment, provider handoff, and review
              status from one place.
            </p>
          </div>
          <Link href="/dashboard/appointments" className={styles.overviewHeroAction}>
            Open requests
          </Link>
        </section>

        <section className={styles.overviewKpiGrid} aria-label="Medication request summary">
          <div className={styles.overviewKpi}>
            <p className={styles.overviewKpiLabel}>Submitted</p>
            <strong className={styles.overviewKpiValue}>{submitted.length}</strong>
          </div>
          <div className={styles.overviewKpi}>
            <p className={styles.overviewKpiLabel}>Under review</p>
            <strong className={styles.overviewKpiValue}>{lifecycle.underReview}</strong>
          </div>
          <div className={styles.overviewKpi}>
            <p className={styles.overviewKpiLabel}>Provider handoff</p>
            <strong className={styles.overviewKpiValue}>{lifecycle.providerHandoff}</strong>
          </div>
          <div className={styles.overviewKpi}>
            <p className={styles.overviewKpiLabel}>Paid total</p>
            <strong className={styles.overviewKpiValue}>
              {formatCurrencyCents(paidTotal, currency)}
            </strong>
          </div>
        </section>

        <div className={styles.overviewWidgetGrid}>
          <section className={styles.overviewSimplePanel} aria-labelledby="pipeline-title">
            <div className={styles.overviewSectionHeader}>
              <div>
                <h2 id="pipeline-title" className={styles.workspaceTitle}>
                  Request Pipeline
                </h2>
                <p className={styles.compactText}>{bookings.length} active records tracked</p>
              </div>
            </div>
            <ul className={styles.overviewStatRows}>
              {[
                { label: "Payment pending", value: lifecycle.paymentPending },
                { label: "Provider handoff", value: lifecycle.providerHandoff },
                { label: "Provider review", value: lifecycle.underReview },
                { label: "Exceptions", value: lifecycle.needsAttention },
                { label: "Next steps", value: lifecycle.nextSteps },
                { label: "Confirmed", value: lifecycle.confirmed },
              ].map(({ label, value }) => (
                <li key={label} className={styles.overviewStatRow}>
                  <span className={styles.overviewStatusLabel}>{label}</span>
                  <strong className={styles.overviewStatRowValue}>{value}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.overviewSimplePanel} aria-labelledby="attention-title">
            <div className={styles.overviewSectionHeader}>
              <div>
                <h2 id="attention-title" className={styles.workspaceTitle}>
                  Exceptions
                </h2>
                <p className={styles.compactText}>Requests with missing data or failed operational steps.</p>
              </div>
            </div>
            {visibleAttentionRows.length > 0 ? (
              <ul className={styles.overviewList}>
                {visibleAttentionRows.map(({ row, status, attention }) => {
                  const tone = medicationRequestToneStyles[status.tone];
                  return (
                    <li key={row.id} className={styles.overviewListItem}>
                      <div>
                        <p className={styles.overviewListTitle}>
                          {medicationRequestPatientName(row.intake_data)}
                        </p>
                        <p className={styles.overviewListMeta}>
                          {attention.reasons.map(attentionReasonLabel).join(" · ")}
                        </p>
                      </div>
                      <span
                        className={styles.statusBadge}
                        style={{ background: tone.background, color: tone.color }}
                      >
                        {status.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.emptyText}>No request exceptions right now.</p>
            )}
          </section>

          <section className={styles.overviewSimplePanel} aria-labelledby="treatment-title">
            <div className={styles.overviewSectionHeader}>
              <div>
                <h2 id="treatment-title" className={styles.workspaceTitle}>
                  Treatment Mix
                </h2>
                <p className={styles.compactText}>Selected medication paths.</p>
              </div>
            </div>
            {treatmentRows.length > 0 ? (
              <ul className={styles.overviewMiniList}>
                {treatmentRows.map(([treatment, count]) => (
                  <li key={treatment}>
                    <span>{treatment}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyText}>No treatment selections yet.</p>
            )}
          </section>

          <section className={styles.overviewSimplePanel} aria-labelledby="state-title">
            <div className={styles.overviewSectionHeader}>
              <div>
                <h2 id="state-title" className={styles.workspaceTitle}>
                  State Breakdown
                </h2>
                <p className={styles.compactText}>Where active requests are coming from.</p>
              </div>
            </div>
            {stateRows.length > 0 ? (
              <ul className={styles.overviewMiniList}>
                {stateRows.map(([state, count]) => (
                  <li key={state}>
                    <span>{state}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyText}>No state data yet.</p>
            )}
          </section>
        </div>

        <section className={styles.overviewSimplePanel} aria-labelledby="latest-title">
          <div className={styles.overviewSectionHeader}>
            <div>
              <h2 id="latest-title" className={styles.workspaceTitle}>
                Latest Medication Requests
              </h2>
              <p className={styles.compactText}>Recent patient movement through the flow.</p>
            </div>
            <Link href="/dashboard/appointments" className={styles.smallAction}>
              View all
            </Link>
          </div>
          {latestRequests.length > 0 ? (
            <ul className={styles.overviewRequestList}>
              {latestRequests.map((row) => {
                const status = medicationRequestStatusView({
                  bookingStatus: row.booking_status,
                  paymentStatus: row.payment_status,
                  olaStatus: row.ola_status,
                  failureReason: row.failure_reason,
                });
                const tone = medicationRequestToneStyles[status.tone];
                const last4 = medicationRequestPhoneLast4(row.intake_data);
                return (
                  <li key={row.id} className={styles.overviewRequestRow}>
                    <div className={styles.overviewRequestPatient}>
                      <p className={styles.overviewListTitle}>
                        {medicationRequestPatientName(row.intake_data)}
                      </p>
                      <p className={styles.overviewListMeta}>
                        {last4 ? `SMS ending ${last4}` : row.user_id.slice(0, 8)}
                      </p>
                    </div>
                    <div>
                      <p className={styles.overviewListTitle}>
                        {medicationRequestTreatmentLabel(row.intake_data)}
                      </p>
                      <p className={styles.overviewListMeta}>
                        {medicationRequestShippingSummary(row.intake_data)}
                      </p>
                    </div>
                    <span
                      className={styles.statusBadge}
                      style={{ background: tone.background, color: tone.color }}
                    >
                      {status.label}
                    </span>
                    <p className={styles.overviewRequestAge}>
                      {medicationRequestAgeLabel(row.updated_at)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.emptyText}>No medication requests yet.</p>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
