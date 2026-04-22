import { createClient } from "@/lib/supabase/server";

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

  const { data: rows, error } = await supabase
    .from("submissions")
    .select("id, status, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const inProgress = rows?.filter((r) => r.status === "in_progress").length ?? 0;
  const total = rows?.length ?? 0;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 26, color: "#172033" }}>Dashboard</h1>
      <p style={{ margin: "0 0 28px", fontSize: 15, color: "#475569", lineHeight: 1.5 }}>
        Intake only covered eligibility and required health information. Use{" "}
        <strong style={{ fontWeight: 600, color: "#172033" }}>Schedule</strong> to book an
        appointment; pharmacy and other steps follow from there.
      </p>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          marginBottom: 28,
        }}
      >
        <section
          style={{
            padding: 20,
            borderRadius: 12,
            border: "1px solid #e5ebf5",
            background: "#fff",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#64748b" }}>
            Care requests
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 700, color: "#172033" }}>
            {total}
          </p>
        </section>
        <section
          style={{
            padding: 20,
            borderRadius: 12,
            border: "1px solid #e5ebf5",
            background: "#fff",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#64748b" }}>
            In progress
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 700, color: "#172033" }}>
            {inProgress}
          </p>
        </section>
      </div>

      {error ? (
        <p role="alert" style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>
          {error.message}
        </p>
      ) : null}

      {!error && (!rows || rows.length === 0) ? (
        <p style={{ margin: 0, fontSize: 15, color: "#172033" }}>
          Nothing in progress yet. Open <strong style={{ fontWeight: 600 }}>Schedule</strong> to book
          an appointment—status and next steps will show here.
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
              {r.status === "in_progress" ? (
                <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b" }}>
                  Continue under <strong style={{ fontWeight: 600 }}>Schedule</strong> to book or
                  manage your appointment when that flow is available.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
