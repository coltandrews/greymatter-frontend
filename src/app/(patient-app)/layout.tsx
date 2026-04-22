import { createClient } from "@/lib/supabase/server";
import { isIntakeComplete } from "@/lib/intakeComplete";
import { patientWelcomeName } from "@/lib/patientDisplayName";
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
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "patient";
  if (role === "staff" || role === "admin") {
    redirect("/dashboard");
  }

  const { data: draftRow } = await supabase
    .from("intake_drafts")
    .select("step")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!isIntakeComplete(draftRow?.step)) {
    redirect("/intake");
  }

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
        welcomeName={patientWelcomeName(user)}
        email={user.email ?? user.id}
      />
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
