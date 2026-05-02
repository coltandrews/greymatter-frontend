import { createClient } from "@/lib/supabase/server";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { patientWelcomeName } from "@/lib/patientDisplayName";
import { PreAuthIntakeSync } from "./PreAuthIntakeSync";
import { PatientTopBar } from "./PatientTopBar";
import { redirect } from "next/navigation";

export default async function PatientAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, demographics")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "patient";
  if (role === "staff" || role === "admin") {
    redirect("/dashboard");
  }

  const { data: draftRow } = await supabase
    .from("intake_drafts")
    .select("step, data")
    .eq("user_id", user.id)
    .maybeSingle();

  const draftData = draftRow?.data as IntakeDraftData | undefined;
  const profileDemo = profile?.demographics as IntakeDraftData | undefined;
  const forWelcome = mergeIntakeAndProfileDemographics(draftData, profileDemo);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "transparent",
      }}
    >
      <PatientTopBar
        welcomeName={patientWelcomeName(user, forWelcome)}
        email={user.email ?? user.id}
      />
      <PreAuthIntakeSync />
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
