import { createClient } from "@/lib/supabase/server";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { patientWelcomeName } from "@/lib/patientDisplayName";
import { hubBookingIntentStatusView } from "@/lib/scheduling/hubBookingStatus";
import { treatmentByKey } from "@/lib/treatments";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PatientTopBar } from "../../../../PatientTopBar";
import styles from "../../../hub.module.css";

type Props = {
  params: Promise<{
    kind: "booking" | "appointment";
    id: string;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function selectedTreatmentName(intakeData: unknown) {
  const intake = asRecord(intakeData);
  const treatmentKey =
    typeof intake.selected_treatment === "string" ? intake.selected_treatment : null;
  return treatmentByKey(treatmentKey)?.name ?? "Medication";
}

export default async function MedicationDetailPage({ params }: Props) {
  const { kind, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const [{ data: profile }, { data: draftRow }] = await Promise.all([
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
  const demographics = mergeIntakeAndProfileDemographics(
    draftRow?.data as IntakeDraftData | undefined,
    profile?.demographics as IntakeDraftData | undefined,
  );

  let treatmentName = "Medication";
  let statusLabel = "Under review";
  let statusText = "Your request is being reviewed.";
  let submittedAt = "";
  let updatedAt = "";
  let orderGuid: string | null = null;
  let nextStepsHref: string | null = null;

  if (kind === "booking") {
    const { data: row } = await supabase
      .from("booking_intents")
      .select("id, booking_status, payment_status, ola_status, selected_slot, intake_data, created_at, updated_at, ola_redirect_url, ola_order_guid")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row) {
      notFound();
    }
    const status = hubBookingIntentStatusView(row);
    treatmentName = selectedTreatmentName(row.intake_data);
    statusLabel = status.label;
    statusText = status.subtitle;
    submittedAt = row.created_at;
    updatedAt = row.updated_at;
    orderGuid = row.ola_order_guid;
    nextStepsHref = row.ola_redirect_url
      ? `/ola-handoff/booking/${encodeURIComponent(row.id)}`
      : null;
  } else if (kind === "appointment") {
    const { data: row } = await supabase
      .from("appointments")
      .select("id, status, starts_at, created_at, updated_at, provider_name, ola_redirect_url, ola_order_guid")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row) {
      notFound();
    }
    treatmentName = "Medication request";
    statusLabel = row.status === "booked" ? "Confirmed" : row.status;
    statusText = row.provider_name?.trim()
      ? `Provider: ${row.provider_name.trim()}`
      : "Provider details are pending.";
    submittedAt = row.created_at;
    updatedAt = row.updated_at;
    orderGuid = row.ola_order_guid;
    nextStepsHref = row.ola_redirect_url
      ? `/ola-handoff/${encodeURIComponent(row.id)}`
      : null;
  } else {
    notFound();
  }

  return (
    <>
      <PatientTopBar
        welcomeName={patientWelcomeName(user, demographics)}
        email={user.email ?? user.id}
      />
      <main className={styles.detailPage}>
        <div className={styles.detailShell}>
          <Link href="/hub" className={styles.detailBack}>
            <span aria-hidden="true">←</span>
            Patient Hub
          </Link>
          <header className={styles.detailHero}>
            <p className={styles.detailKicker}>Medication</p>
            <h1>{treatmentName}</h1>
            <span className={styles.detailStatus}>{statusLabel}</span>
          </header>

          <div className={styles.detailGridPage}>
            <section className={styles.detailPanelPage}>
              <h2>Order status</h2>
              <p className={styles.detailLead}>{statusText}</p>
              <dl className={styles.detailFacts}>
                <div>
                  <dt>Submitted</dt>
                  <dd>{formatDate(submittedAt)}</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{formatDate(updatedAt)}</dd>
                </div>
                {orderGuid ? (
                  <div>
                    <dt>Order ID</dt>
                    <dd>{orderGuid}</dd>
                  </div>
                ) : null}
              </dl>
              {nextStepsHref ? (
                <Link href={nextStepsHref} className={styles.detailPrimary}>
                  Continue next steps
                </Link>
              ) : null}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
