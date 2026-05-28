import { Suspense } from "react";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { isPreAuthIntakeComplete } from "@/lib/intake/preAuthIntake";
import { patientWelcomeName } from "@/lib/patientDisplayName";
import { createClient } from "@/lib/supabase/server";
import { PatientTopBar } from "./(patient-app)/PatientTopBar";
import { PreAuthEligibility } from "./PreAuthEligibility";

type Props = {
  searchParams: Promise<{ new_medication?: string; signin?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let initialPatientData: IntakeDraftData | null = null;

  if (user) {
    const [{ data: draftRow }, { data: profile }] = await Promise.all([
      supabase
        .from("intake_drafts")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("demographics")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    initialPatientData = mergeIntakeAndProfileDemographics(
      draftRow?.data as IntakeDraftData | undefined,
      profile?.demographics as IntakeDraftData | undefined,
    );
  }

  const startAtMedication =
    Boolean(user) &&
    Boolean(sp.new_medication) &&
    Boolean(initialPatientData && isPreAuthIntakeComplete(initialPatientData));

  return (
    <>
      {user ? (
        <PatientTopBar
          welcomeName={patientWelcomeName(user, initialPatientData ?? undefined)}
          email={user.email ?? user.id}
        />
      ) : null}
      <Suspense fallback={null}>
        <PreAuthEligibility
          initialPatientData={initialPatientData}
          isAuthenticated={Boolean(user)}
          startAtMedication={startAtMedication}
        />
      </Suspense>
    </>
  );
}
