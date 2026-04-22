import Link from "next/link";

const intakeSteps = [
  "Sign in or create your account",
  "Confirm eligibility",
  "Complete intake",
  "Choose provider availability",
  "Select pharmacy",
  "Review and submit",
  "Get confirmation",
];

export default function HomePage() {
  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        padding: "48px 24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 900,
          background: "#ffffff",
          borderRadius: 24,
          padding: 32,
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
          Greymatter MVP
        </p>
        <h1 style={{ marginBottom: 12, fontSize: 40 }}>
          Intake flow and operations dashboard scaffold
        </h1>
        <p style={{ marginTop: 0, fontSize: 18, lineHeight: 1.6 }}>
          This frontend repo is prepared for the patient intake experience and
          the internal dashboard. The public landing page is intentionally out
          of scope for this app.
        </p>

        <p style={{ marginTop: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              color: "#2563eb",
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            style={{
              color: "#2563eb",
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            Create account
          </Link>
          <Link
            href="/dashboard"
            style={{
              color: "#64748b",
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            Dashboard (protected)
          </Link>
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            marginTop: 24,
          }}
        >
          {intakeSteps.map((step, index) => (
            <div
              key={step}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 16px",
                border: "1px solid #e5ebf5",
                borderRadius: 16,
              }}
            >
              <strong>{index + 1}.</strong>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
