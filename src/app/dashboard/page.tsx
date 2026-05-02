import Link from "next/link";
import { bookingOperationsSummary } from "@/lib/dashboard/operationsSummary";
import { transactionStatusView } from "@/lib/dashboard/transactions";
import { hubBookingIntentStatusView } from "@/lib/scheduling/hubBookingStatus";
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
  created_at: string;
  updated_at: string;
};

type AppointmentOverviewRow = {
  id: string;
  status: string | null;
  starts_at: string;
  provider_name: string | null;
  updated_at: string;
};

type SubmissionOverviewRow = {
  id: string;
  status: string | null;
  updated_at: string;
};

type StatusTone = "ok" | "pending" | "warning" | "neutral";

function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatCurrencyCents(amountCents: number, currency: string | null) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "usd",
  }).format(amountCents / 100);
}

function sumAmountCents(rows: BookingIntentOverviewRow[]) {
  return rows.reduce((sum, row) => sum + (typeof row.amount_cents === "number" ? row.amount_cents : 0), 0);
}

function primaryCurrency(rows: BookingIntentOverviewRow[]) {
  return rows.find((row) => row.currency?.trim())?.currency ?? "usd";
}

function formatStatus(value: string | null) {
  return value?.replace(/_/g, " ") || "Unknown";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function isTransaction(row: BookingIntentOverviewRow) {
  return Boolean(row.stripe_checkout_session_id) || row.payment_status === "paid";
}

function statusClass(tone: StatusTone) {
  switch (tone) {
    case "ok":
      return styles.overviewBadgeOk;
    case "pending":
      return styles.overviewBadgePending;
    case "warning":
      return styles.overviewBadgeWarning;
    default:
      return styles.overviewBadgeNeutral;
  }
}

function appointmentTone(status: string | null): StatusTone {
  switch (status) {
    case "completed":
    case "confirmed":
    case "booked":
      return "ok";
    case "cancelled":
    case "failed":
      return "warning";
    case "pending":
    case "scheduled":
      return "pending";
    default:
      return "neutral";
  }
}

function bookingTone(row: BookingIntentOverviewRow): StatusTone {
  const view = hubBookingIntentStatusView({
    booking_status: row.booking_status,
    payment_status: row.payment_status,
    ola_status: row.ola_status,
  });
  if (view.tone === "confirmed") {
    return "ok";
  }
  if (view.tone === "review" || view.tone === "action") {
    return "warning";
  }
  if (view.tone === "pending") {
    return "pending";
  }
  return "neutral";
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

export default async function DashboardPage() {
  const { role, supabase, user } = await requireDashboardAccess();
  const [
    { data: bookingRows, error: bookingsError },
    { data: appointmentRows, error: appointmentsError, count: appointmentCount },
    { data: submissionRows, error: submissionsError, count: submissionCount },
  ] = await Promise.all([
    supabase
      .from("booking_intents")
      .select("id, user_id, amount_cents, currency, payment_status, booking_status, ola_status, service_state, stripe_checkout_session_id, failure_reason, created_at, updated_at")
      .neq("booking_status", "draft")
      .order("updated_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("id, status, starts_at, provider_name, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("submissions")
      .select("id, status, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  const bookings = (bookingRows ?? []) as BookingIntentOverviewRow[];
  const appointments = (appointmentRows ?? []) as AppointmentOverviewRow[];
  const submissions = (submissionRows ?? []) as SubmissionOverviewRow[];
  const operationsSummary = bookingOperationsSummary(bookings);
  const transactions = bookings.filter(isTransaction);
  const paidTransactions = transactions.filter((row) => row.payment_status === "paid");
  const pendingTransactions = transactions.filter((row) => row.payment_status === "pending");
  const transactionCurrency = primaryCurrency(transactions);
  const failedTransactions = transactions.filter((row) => row.payment_status === "failed").length;
  const openBookings = operationsSummary.paymentPending + operationsSummary.olaPending + operationsSummary.needsReview;
  const warningItems = [
    operationsSummary.needsReview > 0
      ? `${formatCountLabel(operationsSummary.needsReview, "booking")} need staff review`
      : null,
    operationsSummary.olaPending > 0
      ? `${formatCountLabel(operationsSummary.olaPending, "provider booking")} still processing`
      : null,
    failedTransactions > 0
      ? `${formatCountLabel(failedTransactions, "transaction")} failed`
      : null,
    bookings.some((row) => row.failure_reason)
      ? "Recent booking failures include provider handoff details"
      : null,
  ].filter((item): item is string => Boolean(item));

  const bookingStatusRows = [
    { label: "Open bookings", value: openBookings, tone: "pending" as const },
    { label: "Needs review", value: operationsSummary.needsReview, tone: "warning" as const },
    { label: "Booked", value: operationsSummary.booked, tone: "ok" as const },
  ];
  const paymentStatusRows = [
    { label: "Transactions", value: transactions.length, tone: "neutral" as const },
    {
      label: "Paid total",
      value: formatCurrencyCents(sumAmountCents(paidTransactions), transactionCurrency),
      tone: "ok" as const,
    },
    {
      label: "Pending total",
      value: formatCurrencyCents(sumAmountCents(pendingTransactions), transactionCurrency),
      tone: "pending" as const,
    },
  ];

  const dataError = bookingsError?.message ?? appointmentsError?.message ?? submissionsError?.message ?? null;

  return (
    <DashboardShell
      role={role}
      currentPage="overview"
      title="Admin Portal"
      subtitle="Warnings, status numbers, recent transactions, appointments, and intake activity."
      email={user.email ?? user.id}
    >
      {dataError ? (
        <p role="alert" className={styles.inlineError}>
          {dataError}
        </p>
      ) : null}

      <div className={styles.overviewStack}>
        <section className={styles.overviewSimplePanel} aria-labelledby="overview-status-title">
          <div className={styles.overviewSectionHeader}>
            <div>
              <h2 id="overview-status-title" className={styles.workspaceTitle}>
                Status
              </h2>
              <p className={styles.compactText}>
                {formatCountLabel(bookings.length, "booking request")} tracked
              </p>
            </div>
            <Link href="/dashboard/appointments" className={styles.smallAction}>
              Appointments
            </Link>
          </div>

          <div className={styles.overviewStatusSections}>
            <div className={styles.overviewStatusSection}>
              <p className={styles.overviewMiniTitle}>Booking operations</p>
              <ul className={styles.overviewStatRows}>
                {bookingStatusRows.map((row) => (
                  <li key={row.label} className={styles.overviewStatRow}>
                    <span className={styles.overviewStatusLabel}>{row.label}</span>
                    <strong className={styles.overviewStatRowValue}>{row.value}</strong>
                    <span className={`${styles.overviewBadge} ${statusClass(row.tone)}`}>
                      {row.tone}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.overviewStatusSection}>
              <p className={styles.overviewMiniTitle}>Payments</p>
              <ul className={styles.overviewStatRows}>
                {paymentStatusRows.map((row) => (
                  <li key={row.label} className={styles.overviewStatRow}>
                    <span className={styles.overviewStatusLabel}>{row.label}</span>
                    <strong className={styles.overviewStatRowValue}>{row.value}</strong>
                    <span className={`${styles.overviewBadge} ${statusClass(row.tone)}`}>
                      {row.tone}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.overviewSimplePanel} aria-labelledby="overview-warnings-title">
          <div className={styles.overviewSectionHeader}>
            <div>
              <h2 id="overview-warnings-title" className={styles.workspaceTitle}>
                Warnings
              </h2>
              <p className={styles.compactText}>Items that may need staff attention.</p>
            </div>
            <span className={`${styles.overviewBadge} ${warningItems.length > 0 ? styles.overviewBadgeWarning : styles.overviewBadgeOk}`}>
              {warningItems.length}
            </span>
          </div>

          {warningItems.length > 0 ? (
            <ul className={styles.overviewWarningList}>
              {warningItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyText}>No active warnings.</p>
          )}
        </section>

        <div className={styles.overviewWidgetGrid}>
          <section className={styles.overviewSimplePanel} aria-labelledby="overview-transactions-title">
            <div className={styles.overviewSectionHeader}>
              <div>
                <h2 id="overview-transactions-title" className={styles.workspaceTitle}>
                  Transactions
                </h2>
                <p className={styles.compactText}>{transactions.length} total</p>
              </div>
              <Link href="/dashboard/transactions" className={styles.smallAction}>
                View all
              </Link>
            </div>

            {transactions.length > 0 ? (
              <ul className={styles.overviewList}>
                {transactions.slice(0, 5).map((row) => {
                  const status = transactionStatusView(row.payment_status);
                  return (
                    <li key={row.id} className={styles.overviewListItem}>
                      <div>
                        <p className={styles.overviewListTitle}>Patient {row.user_id.slice(0, 8)}</p>
                        <p className={styles.overviewListMeta}>Updated {formatDate(row.updated_at)}</p>
                      </div>
                      <span
                        className={styles.statusBadge}
                        style={{ background: status.background, color: status.color }}
                      >
                        {status.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.emptyText}>No transactions yet.</p>
            )}
          </section>

          <section className={styles.overviewSimplePanel} aria-labelledby="overview-appointments-title">
            <div className={styles.overviewSectionHeader}>
              <div>
                <h2 id="overview-appointments-title" className={styles.workspaceTitle}>
                  Recent Appointment Status
                </h2>
                <p className={styles.compactText}>Latest appointment updates.</p>
              </div>
            </div>

            {appointments.length > 0 ? (
              <ul className={styles.overviewList}>
                {appointments.map((appointment) => (
                  <li key={appointment.id} className={styles.overviewListItem}>
                    <div>
                      <p className={styles.overviewListTitle}>
                        {appointment.provider_name?.trim() || "Provider pending"}
                      </p>
                      <p className={styles.overviewListMeta}>{formatDate(appointment.starts_at)}</p>
                    </div>
                    <span className={`${styles.overviewBadge} ${statusClass(appointmentTone(appointment.status))}`}>
                      {formatStatus(appointment.status)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyText}>No appointments yet.</p>
            )}
          </section>

          <section className={styles.overviewSimplePanel} aria-labelledby="overview-bookings-title">
            <div className={styles.overviewSectionHeader}>
              <div>
                <h2 id="overview-bookings-title" className={styles.workspaceTitle}>
                  Recent Booking Activity
                </h2>
                <p className={styles.compactText}>Payment and provider flow.</p>
              </div>
            </div>

            {bookings.length > 0 ? (
              <ul className={styles.overviewList}>
                {bookings.slice(0, 5).map((row) => {
                  const status = hubBookingIntentStatusView({
                    booking_status: row.booking_status,
                    payment_status: row.payment_status,
                    ola_status: row.ola_status,
                  });
                  return (
                    <li key={row.id} className={styles.overviewListItem}>
                      <div>
                        <p className={styles.overviewListTitle}>Patient {row.user_id.slice(0, 8)}</p>
                        <p className={styles.overviewListMeta}>Updated {formatDate(row.updated_at)}</p>
                      </div>
                      <span className={`${styles.overviewBadge} ${statusClass(bookingTone(row))}`}>
                        {status.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.emptyText}>No booking activity yet.</p>
            )}
          </section>

          <section className={styles.overviewSimplePanel} aria-labelledby="overview-data-title">
            <div className={styles.overviewSectionHeader}>
              <div>
                <h2 id="overview-data-title" className={styles.workspaceTitle}>
                  Other Data
                </h2>
                <p className={styles.compactText}>Intake and state coverage.</p>
              </div>
            </div>

            <div className={styles.overviewDataSplit}>
              <div>
                <p className={styles.overviewMiniTitle}>Recent submissions</p>
                {submissions.length > 0 ? (
                  <ul className={styles.overviewMiniList}>
                    {submissions.slice(0, 4).map((submission) => (
                      <li key={submission.id}>
                        <span>{formatStatus(submission.status)}</span>
                        <span>{formatDate(submission.updated_at)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyText}>No submissions yet.</p>
                )}
              </div>

              <div>
                <p className={styles.overviewMiniTitle}>Top states</p>
                {stateBreakdown(bookings).length > 0 ? (
                  <ul className={styles.overviewMiniList}>
                    {stateBreakdown(bookings).map(([state, count]) => (
                      <li key={state}>
                        <span>{state}</span>
                        <strong>{count}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyText}>No state data yet.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
