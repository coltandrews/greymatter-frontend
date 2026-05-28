import { Suspense } from "react";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import {
  shouldRedirectAuthenticatedRootToHub,
  shouldStartAtMedicationSelection,
} from "@/lib/intake/loggedInRequestFlow";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { patientWelcomeName } from "@/lib/patientDisplayName";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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

  if (
    shouldRedirectAuthenticatedRootToHub({
      isAuthenticated: Boolean(user),
      requestedNewMedication: Boolean(sp.new_medication),
    })
  ) {
    redirect("/hub");
  }

  const startAtMedication = shouldStartAtMedicationSelection({
    initialPatientData,
    isAuthenticated: Boolean(user),
    requestedNewMedication: Boolean(sp.new_medication),
  });

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
