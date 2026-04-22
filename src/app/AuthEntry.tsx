"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Mode = "signup" | "signin";

const field = {
  display: "grid" as const,
  gap: 6,
  fontSize: 14,
};

const input = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 16,
};

export function AuthEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = searchParams.get("signin");
    if (q === "1" || q === "true") {
      setMode("signin");
    }
  }, [searchParams]);

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setMessage("Check your email to finish.");
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
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
        padding: "32px 20px",
        minHeight: "100vh",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 28,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5ebf5",
        }}
      >
        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 600 }}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </h1>

        <form
          onSubmit={mode === "signup" ? onSignUp : onSignIn}
          style={{ display: "grid", gap: 14 }}
        >
          <label style={field}>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
          </label>
          <label style={field}>
            Password
            <input
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
            />
          </label>
          {error ? (
            <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
              {error}
            </p>
          ) : null}
          {message ? (
            <p style={{ margin: 0, color: "#15803d", fontSize: 14 }}>{message}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            style={{
              marginTop: 4,
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
            {mode === "signup" ? "Continue" : "Sign in"}
          </button>
        </form>

        <p
          style={{
            margin: "20px 0 0",
            fontSize: 14,
            color: "#64748b",
            textAlign: "center",
          }}
        >
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setMessage(null);
                }}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "#2563eb",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Need an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setMessage(null);
                }}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "#2563eb",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Sign up
              </button>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
