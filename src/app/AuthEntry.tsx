"use client";

import { isExistingUserSignupError, normalizeAuthEmail } from "@/lib/auth/signupErrors";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./authEntry.module.css";

type Mode = "signup" | "signin";

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
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
      setError("Agree to the terms before creating your account.");
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
      const normalizedEmail = normalizeAuthEmail(email);
      const { data, error: err } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: `${origin}/auth/callback?next=/post-login` },
      });
      if (err) {
        if (isExistingUserSignupError(err)) {
          setPassword("");
          setPasswordConfirm("");
          setError(null);
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
        email: normalizeAuthEmail(email),
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

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setPassword("");
    setPasswordConfirm("");
    setError(null);
    setExistingEmailError(false);
    setAwaitingEmail(false);
  }

  function leaveCheckEmail() {
    setAwaitingEmail(false);
    setPassword("");
    setPasswordConfirm("");
    setError(null);
    setExistingEmailError(false);
  }

  const submitDisabled = loading || (mode === "signup" && !termsAccepted);
  const submitLabel = mode === "signup" ? "Create account" : "Sign in";
  const loadingLabel = mode === "signup" ? "Creating account..." : "Signing in...";

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.graphicPanel} aria-hidden="true">
          <div className={styles.graphicHeader}>
            <img src="/brand/logo-horizontal.svg" alt="" className={styles.graphicLogo} />
            <span>Member care portal</span>
          </div>

          <div className={styles.productMap}>
            <div className={`${styles.productNode} ${styles.productNodeLarge}`}>
              <span>GLP-1 care</span>
              <strong>Retatrutide</strong>
            </div>
            <div className={styles.productNode}>
              <span>Skin support</span>
              <strong>Cashmere Cream</strong>
            </div>
            <div className={styles.productNode}>
              <span>Troche therapy</span>
              <strong>Olympus</strong>
            </div>
          </div>

          <div className={styles.flowCard}>
            <div>
              <span>01</span>
              <strong>Profile</strong>
            </div>
            <div>
              <span>02</span>
              <strong>Treatment</strong>
            </div>
            <div>
              <span>03</span>
              <strong>Provider review</strong>
            </div>
          </div>

          <h2>Personalized treatment requests in one patient hub.</h2>
        </div>

        <div className={styles.authPanel}>
          {onBack ? (
            <button type="button" onClick={onBack} className={styles.backButton} aria-label="Back">
              Back
            </button>
          ) : null}

          {awaitingEmail ? (
            <div className={styles.formShell}>
              <img src="/brand/logo-square.svg" alt="GMMD" className={styles.mobileLogo} />
              <p className={styles.kicker}>Verify email</p>
              <h1>Check your email</h1>
              <p className={styles.lead}>
                We sent a link to <strong>{email}</strong>. Open it to finish creating your
                account.
              </p>
              <button type="button" onClick={leaveCheckEmail} className={styles.primaryButton}>
                Back
              </button>
            </div>
          ) : (
            <div className={styles.formShell}>
              <img src="/brand/logo-square.svg" alt="GMMD" className={styles.mobileLogo} />
              <p className={styles.kicker}>{mode === "signup" ? "Create account" : "Welcome back"}</p>
              <h1>{mode === "signup" ? "Create your account" : "Sign in"}</h1>
              <p className={styles.lead}>
                {mode === "signup"
                  ? "Set up your member profile before requesting treatment."
                  : "Continue to your patient hub."}
              </p>

              <form onSubmit={mode === "signup" ? onSignUp : onSignIn} className={styles.form}>
                <label className={styles.field}>
                  Email
                  <input
                    className={styles.input}
                    type="email"
                    autoComplete="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setExistingEmailError(false);
                    }}
                  />
                </label>

                <label className={styles.field}>
                  Password
                  <input
                    className={styles.input}
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>

                {mode === "signup" ? (
                  <label className={styles.field}>
                    Confirm password
                    <input
                      className={styles.input}
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      disabled={loading}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                    />
                  </label>
                ) : null}

                {mode === "signup" ? (
                  <label className={styles.termsRow}>
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      disabled={loading}
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                    />
                    <span>
                      I agree to the{" "}
                      <button
                        type="button"
                        className={styles.inlineLink}
                        aria-haspopup="dialog"
                        onClick={(event) => {
                          event.preventDefault();
                          setTermsOpen(true);
                        }}
                      >
                        Terms of Service
                      </button>
                      , Privacy Policy, telehealth consent, and refund policy.
                    </span>
                  </label>
                ) : null}

                <div className={styles.messageSlot}>
                  {error ? (
                    <p role="alert">{error}</p>
                  ) : existingEmailError ? (
                    <p role="alert">
                      That email is already in use.{" "}
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => switchMode("signin")}
                        className={styles.inlineLink}
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
                  className={styles.primaryButton}
                >
                  {loading ? <span aria-hidden="true" className={styles.spinner} /> : null}
                  {loading ? loadingLabel : submitLabel}
                </button>
              </form>

              <p className={styles.switchText}>
                {mode === "signup" ? "Already have an account?" : "Need an account?"}{" "}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
                >
                  {mode === "signup" ? "Sign in" : "Create account"}
                </button>
              </p>
            </div>
          )}
        </div>
      </section>

      {termsOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={() => setTermsOpen(false)}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.kicker}>Agreement</p>
                <h2 id="terms-title">Terms of Service</h2>
              </div>
              <button type="button" onClick={() => setTermsOpen(false)} aria-label="Close">
                Close
              </button>
            </div>
            <div className={styles.modalBody}>
              <p>
                By creating an account, you request telehealth services through GreyMatter MD
                and consent to electronic communications about your intake, consultation,
                payment, and medication request.
              </p>
              <p>
                Clinical eligibility is determined by a licensed provider. Completing intake
                and payment does not guarantee that medication will be prescribed or shipped.
              </p>
              <p>
                You agree to provide accurate information, upload your own government ID when
                requesting treatment, and keep your contact, shipping, and health information
                current.
              </p>
              <p>
                If a provider determines you are not eligible after payment, your payment will
                be refunded according to the client-approved refund policy.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
