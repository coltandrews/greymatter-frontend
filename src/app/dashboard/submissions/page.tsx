import { DashboardShell } from "../DashboardShell";
import { requireDashboardAccess } from "../dashboardAccess";

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

export default async function SubmissionsPage() {
  const { role, supabase, user } = await requireDashboardAccess();
  const { data: submissions, error } = await supabase
    .from("submissions")
    .select("id, user_id, status, created_at, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <DashboardShell
      role={role}
      currentPage="submissions"
      title="Submissions"
      subtitle="Submitted intake records and patient progress."
      email={user.email ?? user.id}
    >
      {error ? (
        <p role="alert" style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>
          {error.message}
        </p>
      ) : null}

      {!error && submissions && submissions.length > 0 ? (
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
              {submissions.map((submission) => (
                <tr key={submission.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td
                    style={{
                      padding: "12px 12px 12px 0",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 12,
                      color: "#172033",
                    }}
                    title={submission.user_id}
                  >
                    {submission.user_id}
                  </td>
                  <td style={{ padding: "12px", textTransform: "capitalize" as const }}>
                    {submission.status.replace("_", " ")}
                  </td>
                  <td style={{ padding: "12px", color: "#475569" }}>
                    {formatWhen(submission.updated_at)}
                  </td>
                  <td style={{ padding: "12px 0 12px 12px", color: "#475569" }}>
                    {formatWhen(submission.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!error && (!submissions || submissions.length === 0) ? (
        <p style={{ margin: 0, fontSize: 15, color: "#64748b" }}>
          No submissions yet.
        </p>
      ) : null}
    </DashboardShell>
  );
}
