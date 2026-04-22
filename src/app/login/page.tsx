"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

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
          width: "100%",
          maxWidth: 400,
          padding: 32,
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5ebf5",
          boxShadow: "0 20px 60px rgba(24, 45, 84, 0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Sign in</h1>
        <p style={{ marginTop: 0, color: "#4f6b95", fontSize: 14 }}>
          Use the email and password for your Greymatter account.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: 16, marginTop: 24 }}
        >
          <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 16,
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 16,
              }}
            />
          </label>
          {error ? (
            <p
              role="alert"
              style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              border: "none",
              background: loading ? "#94a3b8" : "#172033",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 14, color: "#4f6b95" }}>
          No account?{" "}
          <Link href="/signup" style={{ color: "#2563eb", fontWeight: 600 }}>
            Create one
          </Link>
        </p>
        <p style={{ marginTop: 12, fontSize: 14 }}>
          <Link href="/" style={{ color: "#64748b" }}>
            ← Home
          </Link>
        </p>
      </section>
    </main>
  );
}
