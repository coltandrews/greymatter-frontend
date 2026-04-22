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
          border: "1px solid #e5ebf5",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Sign-in link did not work</h1>
        <p style={{ color: "#4f6b95", lineHeight: 1.6 }}>
          The link may have expired or already been used. Try signing in again.
        </p>
        <p style={{ marginTop: 24 }}>
          <Link href="/login" style={{ color: "#2563eb", fontWeight: 600 }}>
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
