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

const card = {
  width: "100%" as const,
  maxWidth: 380,
  padding: 28,
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5ebf5",
};

function isExistingUserSignupError(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already exists") ||
    (m.includes("email") && m.includes("already"))
  );
}

export function AuthEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [awaitingEmail, setAwaitingEmail] = useState(false);
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
    setNotice(null);
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
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
      if (isExistingUserSignupError(err.message)) {
        setMode("signin");
        setPassword("");
        setPasswordConfirm("");
        setNotice("That email already has an account. Sign in below.");
        return;
      }
      setError(err.message);
      return;
    }
    if (data.session) {
      router.push("/post-login");
      router.refresh();
      return;
    }
    setAwaitingEmail(true);
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
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
    router.push("/post-login");
    router.refresh();
  }

  function leaveCheckEmail() {
    setAwaitingEmail(false);
    setPassword("");
    setPasswordConfirm("");
    setError(null);
    setNotice(null);
  }

  if (awaitingEmail) {
    return (
      <main
        style={{
          display: "grid",
          placeItems: "center",
          padding: "32px 20px",
          minHeight: "100vh",
        }}
      >
        <section style={card}>
          <h1 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 600 }}>
            Check your email
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
            We sent a link to <strong>{email}</strong>. Open it to finish.
          </p>
          <button
            type="button"
            onClick={leaveCheckEmail}
            style={{
              marginTop: 20,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#172033",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back
          </button>
        </section>
      </main>
    );
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
      <section style={card}>
        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 600 }}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </h1>
        {notice ? (
          <p
            style={{
              margin: "-12px 0 16px",
              fontSize: 14,
              color: "#64748b",
              lineHeight: 1.45,
            }}
          >
            {notice}
          </p>
        ) : null}

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
          {mode === "signup" ? (
            <label style={field}>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                style={input}
              />
            </label>
          ) : null}
          {error ? (
            <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
              {error}
            </p>
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
                  setPasswordConfirm("");
                  setError(null);
                  setNotice(null);
                  setAwaitingEmail(false);
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
                  setPasswordConfirm("");
                  setError(null);
                  setNotice(null);
                  setAwaitingEmail(false);
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
