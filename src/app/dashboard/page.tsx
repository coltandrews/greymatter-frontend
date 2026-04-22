import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
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

export default async function DashboardPage() {
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
  if (role !== "staff" && role !== "admin") {
    redirect("/intake");
  }

  const { data: submissions, error: subErr } = await supabase
    .from("submissions")
    .select("id, user_id, status, created_at, updated_at")
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
          maxWidth: 960,
          padding: 28,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5ebf5",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Submissions</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b" }}>
          {user.email ?? user.id}
        </p>

        {subErr ? (
          <p role="alert" style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>
            {subErr.message}
          </p>
        ) : null}

        {!subErr && submissions && submissions.length > 0 ? (
          <div style={{ overflowX: "auto", marginBottom: 20 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5ebf5" }}>
                  <th style={{ padding: "10px 12px 10px 0", color: "#64748b", fontWeight: 600 }}>
                    Patient user id
                  </th>
                  <th style={{ padding: "10px 12px", color: "#64748b", fontWeight: 600 }}>
                    Status
                  </th>
                  <th style={{ padding: "10px 12px", color: "#64748b", fontWeight: 600 }}>
                    Updated
                  </th>
                  <th style={{ padding: "10px 0 10px 12px", color: "#64748b", fontWeight: 600 }}>
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td
                      style={{
                        padding: "12px 12px 12px 0",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 12,
                        color: "#172033",
                      }}
                      title={s.user_id}
                    >
                      {s.user_id}
                    </td>
                    <td style={{ padding: "12px", textTransform: "capitalize" as const }}>
                      {s.status.replace("_", " ")}
                    </td>
                    <td style={{ padding: "12px", color: "#475569" }}>{formatWhen(s.updated_at)}</td>
                    <td style={{ padding: "12px 0 12px 12px", color: "#475569" }}>
                      {formatWhen(s.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!subErr && (!submissions || submissions.length === 0) ? (
          <p style={{ margin: "0 0 20px", fontSize: 15, color: "#64748b" }}>
            No submissions yet.
          </p>
        ) : null}

        <SignOutButton />
      </section>
    </main>
  );
}
