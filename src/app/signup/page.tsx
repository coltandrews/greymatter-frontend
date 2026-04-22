"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setMessage(
      "Check your email to confirm your account, then sign in here.",
    );
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
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Create account</h1>
        <p style={{ marginTop: 0, color: "#4f6b95", fontSize: 14 }}>
          You will use this account for the intake flow and (if applicable)
          staff dashboard.
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
              autoComplete="new-password"
              required
              minLength={8}
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
          {message ? (
            <p style={{ margin: 0, color: "#15803d", fontSize: 14 }}>
              {message}
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
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 14, color: "#4f6b95" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#2563eb", fontWeight: 600 }}>
            Sign in
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
