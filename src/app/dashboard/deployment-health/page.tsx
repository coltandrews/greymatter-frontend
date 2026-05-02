import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConfigHealthPanel } from "../ConfigHealthPanel";
import { DashboardNav } from "../DashboardNav";

export default async function DeploymentHealthPage() {
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
  if (role === "staff") {
    redirect("/dashboard");
  }
  if (role !== "admin") {
    redirect("/hub");
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
          maxWidth: 960,
          padding: 28,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5ebf5",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Deployment health</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b" }}>
          Admin-only backend configuration checks.
        </p>

        <DashboardNav role="admin" currentPage="deployment-health" />

        <ConfigHealthPanel />

        <div style={{ marginTop: 24 }}>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
