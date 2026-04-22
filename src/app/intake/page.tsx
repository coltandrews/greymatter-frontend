import { createClient } from "@/lib/supabase/server";
import { IntakeWizard } from "@/app/intake/IntakeWizard";
import { isIntakeComplete } from "@/lib/intakeComplete";
import { SignOutButton } from "@/components/SignOutButton";
import { redirect } from "next/navigation";

export default async function IntakePage() {
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

  if (isIntakeComplete(draftRow?.step)) {
    redirect("/hub");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        background: "#f8fafc",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 28,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5ebf5",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 22, color: "#172033" }}>Intake</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b" }}>
          {user.email ?? user.id}
        </p>
        <p style={{ margin: "0 0 20px", fontSize: 15, lineHeight: 1.5, color: "#172033" }}>
          Answer a few questions so we can route you correctly. This only takes a minute.
        </p>
        <IntakeWizard />
        <SignOutButton />
      </section>
    </main>
  );
}
