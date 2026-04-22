import { createClient } from "@/lib/supabase/server";
import { isIntakeComplete } from "@/lib/intakeComplete";
import Link from "next/link";

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
    return null;
  }

  const { data: draftRow } = await supabase
    .from("intake_drafts")
    .select("step")
    .eq("user_id", user.id)
    .maybeSingle();

  const intakeComplete = isIntakeComplete(draftRow?.step);

  const { data: rows, error } = await supabase
    .from("submissions")
    .select("id, status, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 26, color: "#172033" }}>My visits</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>
        Track intake and visit status. Scheduling and pharmacy will appear here as we connect
        them.
      </p>

      {error ? (
        <p role="alert" style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>
          {error.message}
        </p>
      ) : null}

      {!error && (!rows || rows.length === 0) ? (
        <p style={{ margin: "0 0 20px", fontSize: 15, color: "#172033" }}>
          {intakeComplete
            ? "No visit records yet. They will appear here as your care moves forward."
            : "No visits yet. Complete intake to create one."}
        </p>
      ) : null}

      {!error && rows && rows.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
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
                background: "#fff",
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
              {r.status === "in_progress" && !intakeComplete ? (
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
              {r.status === "in_progress" && intakeComplete ? (
                <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b" }}>
                  Scheduling and next steps will show here when available.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!error && (!rows || rows.length === 0) && !intakeComplete ? (
        <Link
          href="/intake"
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "#172033",
          }}
        >
          Go to intake →
        </Link>
      ) : null}
    </div>
  );
}
