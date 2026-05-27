"use client";

import { createClient } from "@/lib/supabase/client";
import { syncStoredPreAuthIntake } from "@/lib/intake/syncStoredPreAuthIntake";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Mode = "signup" | "signin";

const field = {
  display: "grid" as const,
  gap: 8,
  fontSize: 14,
  color: "#333333",
  fontWeight: 400,
};

const input = {
  minHeight: 48,
  padding: "0 14px",
  borderRadius: 7,
  border: "1px solid #b4b4b4",
  background: "rgba(255, 255, 255, 0.78)",
  color: "#171717",
  fontSize: 16,
  outlineColor: "#3487ed",
};

const card = {
  width: "100%" as const,
  maxWidth: 408,
  minHeight: "auto",
  display: "grid" as const,
};

const logo = {
  display: "block" as const,
  width: 132,
  maxWidth: "46%",
  height: "auto",
  margin: "8px auto 24px",
};

const pageBackground = "var(--gm-page-bg)";

const progressTrack = {
  width: "100%",
  height: 4,
  borderRadius: 999,
  background: "#d0d0d0",
  marginBottom: 38,
};

const messageSlot = {
  minHeight: 18,
  margin: 0,
  color: "#b91c1c",
  fontSize: 14,
  lineHeight: 1.3,
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
    let keepLockedForNavigation = false;
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
        keepLockedForNavigation = true;
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
      if (!keepLockedForNavigation) {
        submittingRef.current = false;
        setLoading(false);
      }
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
    let keepLockedForNavigation = false;
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
      keepLockedForNavigation = true;
      router.push("/post-login");
      router.refresh();
      return;
    } finally {
      if (!keepLockedForNavigation) {
        submittingRef.current = false;
        setLoading(false);
      }
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
            <img src="/brand/gmmd-intake-logo.png" alt="GMMD" style={logo} />
            <div style={progressTrack} />
          </header>
          <div style={{ display: "grid", minHeight: 0 }}>
            <h1 style={{ margin: "0 0 14px", fontSize: 22, lineHeight: 1.1, fontWeight: 400, color: "#171717" }}>
              Check your email
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: "#4f4f4f", lineHeight: 1.45 }}>
              We sent a link to <strong>{email}</strong>. Open it to finish.
            </p>
          <button
            type="button"
            onClick={leaveCheckEmail}
            style={{
              marginTop: 32,
              width: "100%",
              minHeight: 52,
              padding: "0 18px",
              borderRadius: 7,
              border: "none",
              background: "#3487ed",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 600,
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
          <img src="/brand/gmmd-intake-logo.png" alt="GMMD" style={logo} />
          <div style={progressTrack} />
        </header>
        <div style={{ display: "grid", minHeight: 0 }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 22, lineHeight: 1.1, fontWeight: 400, color: "#171717" }}>
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
              disabled={loading}
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
              disabled={loading}
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
                disabled={loading}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                style={input}
              />
            </label>
          ) : (
            <div style={{ display: "none" }} aria-hidden="true" />
          )}
          <div style={{ minHeight: existingEmailError ? 38 : 18 }}>
            {error ? (
              <p role="alert" style={messageSlot}>
                {error}
              </p>
            ) : existingEmailError ? (
              <p role="alert" style={messageSlot}>
              That email is already in use.{" "}
              <button
                type="button"
                disabled={loading}
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
                  color: "#2563eb",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                Sign in here
              </button>
              .
            </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            style={{
              marginTop: 20,
              minHeight: 52,
              padding: "0 18px",
              borderRadius: 7,
              border: "none",
              background: loading ? "#d0d0d0" : "#3487ed",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
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
            color: "#4f4f4f",
            textAlign: "center",
          }}
        >
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
                <button
                type="button"
                disabled={loading}
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
                  cursor: loading ? "not-allowed" : "pointer",
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
                disabled={loading}
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
                  cursor: loading ? "not-allowed" : "pointer",
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
