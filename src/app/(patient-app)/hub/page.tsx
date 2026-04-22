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

function StubBlock({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: "16px 18px",
        borderRadius: 10,
        border: "1px dashed #cbd5e1",
        background: "#fff",
        fontSize: 14,
        color: "#64748b",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
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

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "28px 24px 48px",
      }}
    >
      <h1 style={{ margin: "0 0 6px", fontSize: 26, color: "#172033" }}>Your care</h1>
      <p style={{ margin: "0 0 32px", fontSize: 15, color: "#475569", lineHeight: 1.5 }}>
        Schedule visits, see what&apos;s coming up, manage prescriptions, and update your account—all
        in one place.
      </p>

      <section id="visits" style={{ scrollMarginTop: 24 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#172033" }}>Visits</h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
          Book a new appointment or follow up on care you&apos;ve already started.
        </p>
        <button
          type="button"
          disabled
          style={{
            padding: "12px 20px",
            borderRadius: 8,
            border: "none",
            background: "#94a3b8",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "not-allowed",
          }}
        >
          Schedule a new visit
        </button>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#94a3b8" }}>
          Scheduling connects to your provider next—we&apos;ll turn this on when the integration is
          ready.
        </p>

        <h3 style={{ margin: "28px 0 12px", fontSize: 15, color: "#172033" }}>Upcoming &amp; in progress</h3>
        {error ? (
          <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
            {error.message}
          </p>
        ) : null}
        {!error && (!rows || rows.length === 0) ? (
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
            No active visits yet. When you schedule, they&apos;ll show up here.
          </p>
        ) : null}
        {!error && rows && rows.length > 0 ? (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 10,
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
                    marginBottom: 4,
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
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section id="prescriptions" style={{ marginTop: 40, scrollMarginTop: 24 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#172033" }}>Prescriptions</h2>
        <p style={{ margin: "0 0 4px", fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
          See current medications and pharmacy details tied to your care.
        </p>
        <StubBlock>
          Prescription list and pharmacy preferences will appear here after we connect to your
          provider and pharmacy data.
        </StubBlock>
      </section>

      <section id="account" style={{ marginTop: 40, scrollMarginTop: 24 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#172033" }}>Account</h2>
        <p style={{ margin: "0 0 4px", fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
          Update your profile, contact information, and sign-in settings.
        </p>
        <StubBlock>
          Profile editing and HIPAA-related preferences will live here. For now, use Sign out in
          the header if you need to switch accounts.
        </StubBlock>
      </section>
    </main>
  );
}
