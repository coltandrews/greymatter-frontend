import { SignOutButton } from "@/components/SignOutButton";

export function PatientTopBar({ email }: { email: string }) {
  return (
    <header
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        padding: "16px 24px",
        background: "#fff",
        borderBottom: "1px solid #e5ebf5",
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#172033",
            textTransform: "uppercase" as const,
          }}
        >
          Greymatter
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Patient hub</p>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, color: "#64748b" }}>{email}</span>
        <SignOutButton noMargin />
      </div>
    </header>
  );
}
