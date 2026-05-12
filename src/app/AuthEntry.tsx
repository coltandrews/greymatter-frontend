"use client";

import { createClient } from "@/lib/supabase/client";
import { syncStoredPreAuthIntake } from "@/lib/intake/syncStoredPreAuthIntake";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Mode = "signup" | "signin";

const field = {
  display: "grid" as const,
  gap: 6,
  fontSize: 14,
  color: "#eef3f8",
  fontWeight: 700,
};

const input = {
  padding: "11px 12px",
  borderRadius: 8,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "#090d12",
  color: "#eef3f8",
  fontSize: 16,
};

const card = {
  width: "100%" as const,
  maxWidth: 380,
  padding: 28,
  background: "rgba(12, 17, 22, 0.94)",
  borderRadius: 8,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  boxShadow: "0 34px 90px rgba(0, 0, 0, 0.42)",
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

export function AuthEntry({
  initialMode = "signup",
  intakeReady = false,
}: {
  initialMode?: Mode;
  intakeReady?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [existingEmailError, setExistingEmailError] = useState(false);
  const [awaitingEmail, setAwaitingEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = searchParams.get("signin");
    if (q === "1" || q === "true") {
      setMode("signin");
      return;
    }
    setMode(initialMode);
  }, [initialMode, searchParams]);

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingEmailError(false);
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
      options: { emailRedirectTo: `${origin}/auth/callback?next=/checkout` },
    });
    setLoading(false);
    if (err) {
      if (isExistingUserSignupError(err.message)) {
        setPassword("");
        setPasswordConfirm("");
        setExistingEmailError(true);
        return;
      }
      setError(err.message);
      return;
    }
    if (data.session) {
      await syncStoredPreAuthIntake(supabase, data.session.user.id);
      router.push(intakeReady ? "/checkout" : "/post-login");
      router.refresh();
      return;
    }

    // Duplicate email: Supabase returns no error and no session, but user.identities is empty
    // (avoids enumeration). Real new signups still have at least one identity while awaiting confirm.
    const identities = data.user?.identities;
    if (
      data.user &&
      (!identities || identities.length === 0)
    ) {
      setPassword("");
      setPasswordConfirm("");
      setExistingEmailError(true);
      return;
    }

    setAwaitingEmail(true);
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingEmailError(false);
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await syncStoredPreAuthIntake(supabase, user.id);
    }
    router.push(intakeReady ? "/checkout" : "/post-login");
    router.refresh();
  }

  function leaveCheckEmail() {
    setAwaitingEmail(false);
    setPassword("");
    setPasswordConfirm("");
    setError(null);
    setExistingEmailError(false);
  }

  if (awaitingEmail) {
    return (
      <main
        style={{
          display: "grid",
          placeItems: "center",
          padding: "32px 20px",
          minHeight: "100vh",
          background: "#07090d",
        }}
      >
        <section style={card}>
          <h1 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 800, color: "#eef3f8" }}>
            Check your email
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#8f9ba8", lineHeight: 1.5 }}>
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
              border: "1px solid rgba(148, 163, 184, 0.22)",
              background: "#111922",
              color: "#eef3f8",
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
        background: "#07090d",
      }}
    >
      <section style={card}>
        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800, color: "#eef3f8" }}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </h1>
        {intakeReady ? (
          <p style={{ margin: "-8px 0 18px", fontSize: 14, color: "#8f9ba8", lineHeight: 1.5 }}>
            Your intake answers are ready. They will be saved to your account when you continue.
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
              onChange={(e) => {
                setEmail(e.target.value);
                setExistingEmailError(false);
              }}
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
            <p role="alert" style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>
              {error}
            </p>
          ) : null}
          {existingEmailError ? (
            <p role="alert" style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>
              That email is already in use.{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setPassword("");
                  setPasswordConfirm("");
                  setError(null);
                  setExistingEmailError(false);
                }}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "#73d2ff",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Sign in here
              </button>
              .
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
              background: loading ? "#334155" : "#73d2ff",
              color: "#061016",
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
            color: "#8f9ba8",
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
                  setExistingEmailError(false);
                  setAwaitingEmail(false);
                }}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "#73d2ff",
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
                  setExistingEmailError(false);
                  setAwaitingEmail(false);
                }}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "#73d2ff",
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
