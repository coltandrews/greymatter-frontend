import {
  memberProfileComplete,
  type IntakeDraftData,
} from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingProfileForm } from "./OnboardingProfileForm";
import styles from "./onboarding.module.css";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [{ data: profile }, { data: draftRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, demographics")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("intake_drafts")
      .select("step, data")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const role = profile?.role ?? "patient";
  if (role === "staff" || role === "admin") {
    redirect("/dashboard");
  }

  const initialData = mergeIntakeAndProfileDemographics(
    draftRow?.data as IntakeDraftData | undefined,
    profile?.demographics as IntakeDraftData | undefined,
  );

  if (memberProfileComplete(initialData)) {
    redirect("/hub");
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <img className={styles.logo} src="/brand/logo-square.svg" alt="GMMD" />
        <div className={styles.panel}>
          <div className={styles.header}>
            <p className={styles.kicker}>Member profile</p>
            <h1>Complete your account</h1>
            <p>
              Add the basic patient details we need before you request a treatment.
            </p>
          </div>
          <OnboardingProfileForm
            email={user.email ?? ""}
            patientId={user.id}
            initialStep={draftRow?.step ?? "account_onboarding"}
            initialData={initialData}
          />
        </div>
      </section>
    </main>
  );
}
