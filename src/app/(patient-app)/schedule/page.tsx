import { createClient } from "@/lib/supabase/server";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import Link from "next/link";
import { ScheduleFlow } from "./ScheduleFlow";
import styles from "./schedule.module.css";

type Props = {
  searchParams: Promise<{ payment?: string }>;
};

export default async function SchedulePage({ searchParams }: Props) {
  const sp = await searchParams;
  const paymentCancelled = sp.payment === "cancelled";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: draft }, { data: profileRow }] = await Promise.all([
    supabase.from("intake_drafts").select("data").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("demographics").eq("id", user.id).maybeSingle(),
  ]);

  const merged = mergeIntakeAndProfileDemographics(
    draft?.data as IntakeDraftData | undefined,
    profileRow?.demographics as IntakeDraftData | undefined,
  );
  const serviceState = merged.service_state?.trim() || null;

  return (
    <main className={styles.page}>
      <Link href="/hub" className={styles.back}>
        ← Patient Hub
      </Link>
      {paymentCancelled ? (
        <p className={styles.stateNote}>
          Checkout was cancelled. Your appointment was not booked.
        </p>
      ) : null}
      <ScheduleFlow
        patient={merged}
        serviceState={serviceState}
      />
    </main>
  );
}
