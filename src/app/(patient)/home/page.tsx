import { createClient } from "@/lib/supabase/server";
import { isIntakeComplete } from "@/lib/intakeComplete";
import Link from "next/link";

export default async function PatientHomePage() {
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

  const { data: rows } = await supabase
    .from("submissions")
    .select("id, status")
    .eq("user_id", user.id);

  const inProgress = rows?.filter((r) => r.status === "in_progress").length ?? 0;
  const total = rows?.length ?? 0;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 26, color: "#172033" }}>Welcome</h1>
      <p style={{ margin: "0 0 28px", fontSize: 15, color: "#475569", lineHeight: 1.5 }}>
        {intakeComplete
          ? "Review your visits from the sidebar, or sign out when you are done."
          : "Complete the one-time intake to get started, then use My visits to track progress."}
      </p>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
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
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#64748b" }}>Visits</p>
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

      <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 16 }}>
        {!intakeComplete ? (
          <Link
            href="/intake"
            style={{
              display: "inline-block",
              padding: "12px 20px",
              borderRadius: 8,
              background: "#172033",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {inProgress > 0 ? "Continue intake" : "Start intake"}
          </Link>
        ) : null}
        <Link
          href="/hub"
          style={{
            display: "inline-block",
            padding: "12px 20px",
            borderRadius: 8,
            border: intakeComplete ? "none" : "1px solid #cbd5e1",
            background: intakeComplete ? "#172033" : "#fff",
            color: intakeComplete ? "#fff" : "#172033",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          My visits
        </Link>
      </div>
    </div>
  );
}
