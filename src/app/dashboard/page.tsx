import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/app/dashboard/SignOutButton";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
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
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Dashboard</h1>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b" }}>
          {user.email ?? user.id}
        </p>
        <SignOutButton />
      </section>
    </main>
  );
}
