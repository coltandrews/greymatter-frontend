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
        alignItems: "center",
        padding: "42px 24px 56px",
        background: "#f8fafc",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 860,
          margin: "0 auto",
          padding: "34px 38px",
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e5ebf5",
          boxShadow: "0 18px 50px rgba(23, 32, 51, 0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 26, color: "#172033" }}>
          Health intake & eligibility
        </h1>
        <p style={{ margin: "0 0 26px", fontSize: 14, color: "#64748b" }}>
          {user.email ?? user.id}
        </p>
        <IntakeWizard />
      </section>
    </main>
  );
}
