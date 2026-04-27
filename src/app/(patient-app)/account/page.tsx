import { createClient } from "@/lib/supabase/server";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountProfileForm } from "./AccountProfileForm";
import styles from "./account.module.css";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [{ data: draftRow }, { data: profileRow }, { data: olaRows }] = await Promise.all([
    supabase
      .from("intake_drafts")
      .select("step, data")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("demographics").eq("id", user.id).maybeSingle(),
    supabase
      .from("appointments")
      .select("ola_user_guid")
      .eq("user_id", user.id)
      .not("ola_user_guid", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const draftData = draftRow?.data as IntakeDraftData | undefined;
  const profileDemo = profileRow?.demographics as IntakeDraftData | undefined;
  const initialData = mergeIntakeAndProfileDemographics(draftData, profileDemo);
  const initialStep = draftRow?.step ?? "paused_before_scheduling";

  return (
    <main className={styles.page}>
      <Link href="/hub" className={styles.back}>
        ← Back to Patient Hub
      </Link>

      <div className={styles.card}>
        <h1 className={styles.title}>Account</h1>
        <p className={styles.subtitle}>
          Update the settings that affect eligibility and scheduling.
        </p>

        <AccountProfileForm
          email={user.email ?? ""}
          patientId={user.id}
          olaUserGuid={olaRows?.[0]?.ola_user_guid ?? null}
          initialStep={initialStep}
          initialData={initialData}
        />
      </div>
    </main>
  );
}
