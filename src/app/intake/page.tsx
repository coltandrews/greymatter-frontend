import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { IntakeEligibilityForm } from "@/app/intake/IntakeEligibilityForm";
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

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        minHeight: "100vh",
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
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Intake</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b" }}>
          {user.email ?? user.id}
        </p>
        <IntakeEligibilityForm />
        <SignOutButton />
      </section>
    </main>
  );
}
