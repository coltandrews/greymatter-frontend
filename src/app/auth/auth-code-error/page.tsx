import Link from "next/link";

export default function AuthCodeErrorPage() {
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
          maxWidth: 480,
          padding: 32,
          background: "#fff",
          borderRadius: 16,
          border: "1px solid rgba(23, 23, 23, 0.14)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Link invalid or expired</h1>
        <p style={{ margin: "12px 0 0", color: "#555555", fontSize: 14 }}>
          Try again from the app.
        </p>
        <p style={{ marginTop: 20 }}>
          <Link href="/" style={{ color: "#171717", fontWeight: 600 }}>
            Back
          </Link>
        </p>
      </section>
    </main>
  );
}
