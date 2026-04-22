import { createClient } from "@/lib/supabase/server";
import { IntakeWizard } from "@/app/intake/IntakeWizard";
import { isIntakeComplete } from "@/lib/intakeComplete";
import { redirect } from "next/navigation";

export default async function IntakePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: draftRow } = await supabase
    .from("intake_drafts")
    .select("step")
    .eq("user_id", user.id)
    .maybeSingle();

  if (isIntakeComplete(draftRow?.step)) {
    redirect("/home");
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 26, color: "#172033" }}>Intake</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>
        Answer a few questions so we can route you correctly.
      </p>
      <div
        style={{
          padding: 28,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5ebf5",
        }}
      >
        <IntakeWizard />
      </div>
    </div>
  );
}
