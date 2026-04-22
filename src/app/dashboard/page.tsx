import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/app/dashboard/SignOutButton";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        padding: "48px 24px",
        minHeight: "100vh",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 640,
          padding: 32,
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5ebf5",
          boxShadow: "0 20px 60px rgba(24, 45, 84, 0.08)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#4f6b95",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Protected
        </p>
        <h1 style={{ marginTop: 8, marginBottom: 12 }}>Dashboard</h1>
        <p style={{ marginTop: 0, color: "#4f6b95", lineHeight: 1.6 }}>
          You are signed in as{" "}
          <strong>{user.email ?? user.id}</strong>. Staff-only UI will grow
          here; intake users will use different routes later.
        </p>
        <p style={{ marginTop: 24, fontSize: 14, wordBreak: "break-all" }}>
          User id: <code>{user.id}</code>
        </p>
        <SignOutButton />
        <p style={{ marginTop: 16 }}>
          <Link href="/" style={{ color: "#2563eb", fontWeight: 600 }}>
            ← Home
          </Link>
        </p>
      </section>
    </main>
  );
}
