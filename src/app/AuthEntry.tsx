"use client";

import { createClient } from "@/lib/supabase/client";
import { syncStoredPreAuthIntake } from "@/lib/intake/syncStoredPreAuthIntake";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Mode = "signup" | "signin";

const field = {
  display: "grid" as const,
  gap: 12,
  fontSize: 14,
  color: "#f2f2f2",
  fontWeight: 400,
};

const input = {
  minHeight: 48,
  padding: "0 20px",
  borderRadius: 7,
  border: "2px solid #d8d8d8",
  background: "transparent",
  color: "#f2f2f2",
  fontSize: 16,
};

const card = {
  width: "100%" as const,
  maxWidth: 380,
  minHeight: "calc(100vh - 56px)",
  display: "grid" as const,
  gridTemplateRows: "auto minmax(0, 1fr)",
};

const logo = {
  display: "block" as const,
  width: 116,
  maxWidth: "42%",
  height: "auto",
  margin: "8px auto 28px",
};

const pageBackground = "#121212";

const progressTrack = {
  width: "100%",
  height: 4,
  borderRadius: 999,
  background: "#666666",
  marginBottom: 56,
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
  const submittingRef = useRef(false);

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
    if (loading || submittingRef.current) {
      return;
    }
    setError(null);
    setExistingEmailError(false);
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${origin}/auth/callback?next=/checkout` },
      });
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
      if (data.user && (!identities || identities.length === 0)) {
        setPassword("");
        setPasswordConfirm("");
        setExistingEmailError(true);
        return;
      }

      setAwaitingEmail(true);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (loading || submittingRef.current) {
      return;
    }
    setError(null);
    setExistingEmailError(false);
    submittingRef.current = true;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
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
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
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
          justifyItems: "center",
          alignItems: "start",
          padding: "28px 20px",
          minHeight: "100vh",
          background: pageBackground,
        }}
      >
        <section style={card}>
          <header>
            <img src="/brand/gmmd-logo-color-transparent.png" alt="GMMD" style={logo} />
            <div style={progressTrack} />
          </header>
          <div style={{ display: "grid", minHeight: 0 }}>
            <h1 style={{ margin: "0 0 14px", fontSize: 22, lineHeight: 1.1, fontWeight: 400, color: "#f2f2f2" }}>
              Check your email
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: "#c9c9c9", lineHeight: 1.45 }}>
              We sent a link to <strong>{email}</strong>. Open it to finish.
            </p>
          <button
            type="button"
            onClick={leaveCheckEmail}
            style={{
              marginTop: "auto",
              width: "100%",
              minHeight: 50,
              padding: "0 18px",
              borderRadius: 0,
              border: "none",
              background: "#3487ed",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 500,
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Back
          </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        display: "grid",
        justifyItems: "center",
        alignItems: "start",
        padding: "28px 20px",
        minHeight: "100vh",
        background: pageBackground,
      }}
    >
      <section style={card}>
        <header>
          <img src="/brand/gmmd-logo-color-transparent.png" alt="GMMD" style={logo} />
          <div style={progressTrack} />
        </header>
        <div style={{ display: "grid", minHeight: 0 }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 22, lineHeight: 1.1, fontWeight: 400, color: "#f2f2f2" }}>
            {mode === "signup" ? "Create account" : "Sign in"}
          </h1>
          {intakeReady ? (
            <p style={{ margin: "0 0 28px", fontSize: 15, color: "#c9c9c9", lineHeight: 1.35 }}>
              Save your intake and continue to payment.
            </p>
          ) : null}

        <form
          onSubmit={mode === "signup" ? onSignUp : onSignIn}
          style={{ display: "grid", gap: 16, minHeight: "52vh" }}
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
              marginTop: "auto",
              minHeight: 50,
              padding: "0 18px",
              borderRadius: 0,
              border: "none",
              background: loading ? "#454545" : "#3487ed",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 500,
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.78 : 1,
            }}
          >
            {loading
              ? mode === "signup"
                ? "Creating account..."
                : "Signing in..."
              : mode === "signup"
                ? "Continue"
                : "Sign in"}
          </button>
        </form>

        <p
          style={{
            margin: "18px 0 0",
            fontSize: 14,
            color: "#c9c9c9",
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
                  color: "#3487ed",
                  fontWeight: 500,
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
                  color: "#3487ed",
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Sign up
              </button>
            </>
          )}
        </p>
        </div>
      </section>
    </main>
  );
}
