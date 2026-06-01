"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Mode = "signup" | "signin";

const field = {
  display: "grid" as const,
  gap: 8,
  fontSize: 14,
  color: "#171717",
  fontWeight: 400,
};

const input = {
  minHeight: 48,
  padding: "0 14px",
  borderRadius: 7,
  border: "2px solid #171717",
  background: "var(--gm-control-bg)",
  color: "#171717",
  fontSize: 16,
  outlineColor: "#171717",
};

const card = {
  width: "100%" as const,
  maxWidth: 408,
  minHeight: "auto",
  display: "grid" as const,
};

const logo = {
  display: "block" as const,
  width: 112,
  maxWidth: "42%",
  height: "auto",
  margin: "8px auto 24px",
};

const pageBackground = "var(--gm-page-bg)";

const progressTrack = {
  width: "100%",
  height: 4,
  borderRadius: 999,
  background: "var(--gm-rule)",
  marginBottom: 38,
};

const authHeader = {
  position: "relative" as const,
};

const authBackArrow = {
  position: "absolute" as const,
  left: 0,
  top: 64,
  border: "none",
  width: 28,
  height: 28,
  display: "grid" as const,
  placeItems: "center",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.72)",
  color: "#171717",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
};

const messageSlot = {
  minHeight: 18,
  margin: 0,
  color: "#b91c1c",
  fontSize: 14,
  lineHeight: 1.3,
};

const termsBox = {
  maxHeight: 132,
  overflowY: "auto" as const,
  padding: "12px 14px",
  border: "1px solid rgba(23, 23, 23, 0.22)",
  borderRadius: 7,
  background: "rgba(255, 255, 255, 0.58)",
  color: "#242424",
  fontSize: 12,
  lineHeight: 1.45,
};

const termsCheck = {
  display: "flex" as const,
  alignItems: "flex-start",
  gap: 10,
  color: "#171717",
  fontSize: 13,
  lineHeight: 1.4,
  cursor: "pointer",
};

const buttonLabel = {
  display: "inline-flex" as const,
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const spinner = {
  width: 16,
  height: 16,
  borderRadius: 999,
  border: "2px solid currentColor",
  borderRightColor: "transparent",
  animation: "gm-spin 700ms linear infinite",
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
  onBack,
}: {
  initialMode?: Mode;
  onBack?: () => void;
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
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
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
    if (!termsAccepted) {
      setError("Review the terms and privacy information before creating your account.");
      return;
    }
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
        options: { emailRedirectTo: `${origin}/auth/callback?next=/post-login` },
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
        keepLockedForNavigation = true;
        router.push("/post-login");
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

  function onTermsScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    const scrolledToBottom =
      target.scrollTop + target.clientHeight >= target.scrollHeight - 4;
    if (scrolledToBottom) {
      setTermsScrolled(true);
    }
  }

  const submitDisabled = loading || (mode === "signup" && !termsAccepted);
  const submitBlocked = mode === "signup" && !termsAccepted;
  const submitLabel = mode === "signup" ? "Create account" : "Sign in";
  const loadingLabel = mode === "signup" ? "Creating account..." : "Signing in...";

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
          <header style={authHeader}>
            {onBack ? (
              <button type="button" onClick={onBack} style={authBackArrow} aria-label="Back">
                ←
              </button>
            ) : null}
            <img src="/brand/logo-square.svg" alt="GMMD" style={logo} />
            <div style={progressTrack} />
          </header>
          <div style={{ display: "grid", minHeight: 0 }}>
            <h1 style={{ margin: "0 0 14px", fontSize: 22, lineHeight: 1.1, fontWeight: 400, color: "#171717" }}>
              Check your email
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: "#242424", lineHeight: 1.45 }}>
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
              borderRadius: 999,
              border: "1px solid rgba(255, 255, 255, 0.78)",
              background: "var(--gm-action-bg)",
              color: "#171717",
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
        <header style={authHeader}>
          {onBack ? (
            <button type="button" onClick={onBack} style={authBackArrow} aria-label="Back">
              ←
            </button>
          ) : null}
          <img src="/brand/logo-square.svg" alt="GMMD" style={logo} />
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
          {mode === "signup" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={termsBox}
                onScroll={onTermsScroll}
                tabIndex={0}
                aria-label="Terms of service and privacy information"
              >
                <p style={{ margin: "0 0 8px" }}>
                  By creating an account, you request telehealth services through GreyMatter MD
                  and consent to electronic communications about your intake, consultation,
                  payment, and medication request.
                </p>
                <p style={{ margin: "0 0 8px" }}>
                  Clinical eligibility is determined by a licensed provider. Completing intake
                  and payment does not guarantee that medication will be prescribed or shipped.
                </p>
                <p style={{ margin: "0 0 8px" }}>
                  You agree to provide accurate information, upload your own government ID, and
                  keep your contact, shipping, and health information current.
                </p>
              </div>
              <label
                style={{
                  ...termsCheck,
                  opacity: termsScrolled ? 1 : 0.62,
                  cursor: termsScrolled ? "pointer" : "not-allowed",
                }}
              >
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  disabled={!termsScrolled || loading}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  I have reviewed and agree to the Terms of Service, Privacy Policy, telehealth
                  consent, and refund policy.
                </span>
              </label>
            </div>
          ) : null}
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
            disabled={submitDisabled}
            aria-busy={loading}
            style={{
              marginTop: 20,
              minHeight: 52,
              padding: "0 18px",
              borderRadius: 999,
              border: loading ? "1px solid #171717" : "1px solid rgba(255, 255, 255, 0.78)",
              background: submitBlocked ? "var(--gm-disabled-bg)" : "var(--gm-action-bg)",
              color: submitBlocked ? "var(--gm-disabled-text)" : "#171717",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "wait" : submitBlocked ? "not-allowed" : "pointer",
            }}
          >
            <span style={buttonLabel}>
              {loading ? <span aria-hidden="true" style={spinner} /> : null}
              {loading ? loadingLabel : submitLabel}
            </span>
          </button>
        </form>

        <p
          style={{
            margin: "18px 0 0",
            fontSize: 14,
            color: "#242424",
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
                  color: "#171717",
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
                  setPassword("");
                  setError(null);
                  setExistingEmailError(false);
                  setAwaitingEmail(false);
                }}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "#171717",
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
