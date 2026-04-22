import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";
import { redirect } from "next/navigation";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default async function HubPage() {
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

  const { data: rows, error } = await supabase
    .from("submissions")
    .select("id, status, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

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
          maxWidth: 520,
          padding: 28,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5ebf5",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>My visits</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b" }}>
          {user.email ?? user.id}
        </p>

        {error ? (
          <p role="alert" style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>
            {error.message}
          </p>
        ) : null}

        {!error && (!rows || rows.length === 0) ? (
          <p style={{ margin: "0 0 20px", fontSize: 15, color: "#172033" }}>
            No visits yet. Start intake to create one.
          </p>
        ) : null}

        {!error && rows && rows.length > 0 ? (
          <ul
            style={{
              listStyle: "none",
              margin: "0 0 20px",
              padding: 0,
              display: "grid",
              gap: 12,
            }}
          >
            {rows.map((r) => (
              <li
                key={r.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid #e5ebf5",
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "8px 12px",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      textTransform: "capitalize" as const,
                      color: "#172033",
                    }}
                  >
                    {r.status.replace("_", " ")}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    Updated {formatWhen(r.updated_at)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                  Started {formatWhen(r.created_at)}
                </p>
                {r.status === "in_progress" ? (
                  <Link
                    href="/intake"
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#172033",
                    }}
                  >
                    Continue intake →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <Link
            href="/intake"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#172033",
            }}
          >
            Go to intake
          </Link>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
