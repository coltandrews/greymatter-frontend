"use client";

import { AuthEntry } from "./AuthEntry";
import { US_STATES } from "./intake/usStates";
import {
  intakeAnswerComplete,
  normalizeIntakeAnswers,
  type IntakeQuestion,
  type IntakeQuestionAnswer,
  type IntakeQuestionAnswers,
} from "@/lib/intake/intakeQuestions";
import {
  PRE_AUTH_INTAKE_STORAGE_KEY,
  serializePreAuthIntake,
  type PreAuthIntakeData,
} from "@/lib/intake/preAuthIntake";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const card = {
  width: "100%" as const,
  maxWidth: 520,
  padding: 28,
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5ebf5",
};

const field = {
  display: "grid" as const,
  gap: 6,
  fontSize: 14,
  fontWeight: 600,
  color: "#172033",
};

const input = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 16,
};

const initial: PreAuthIntakeData = {
  legal_first_name: "",
  legal_last_name: "",
  date_of_birth: "",
  gender: "",
  service_state: "",
  address_state: "",
  for_self: undefined,
};

function stringAnswer(value: IntakeQuestionAnswer | undefined): string {
  return typeof value === "string" ? value : "";
}

function arrayAnswer(value: IntakeQuestionAnswer | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function QuestionField({
  answer,
  onChange,
  question,
}: {
  answer: IntakeQuestionAnswer | undefined;
  onChange: (value: IntakeQuestionAnswer) => void;
  question: IntakeQuestion;
}) {
  const label = (
    <>
      {question.prompt}
      {question.required ? " *" : ""}
    </>
  );

  if (question.question_type === "textarea") {
    return (
      <label style={field}>
        {label}
        <textarea
          value={stringAnswer(answer)}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...input, minHeight: 86, resize: "vertical" }}
        />
        {question.help_text ? <span style={{ color: "#64748b", fontSize: 12 }}>{question.help_text}</span> : null}
      </label>
    );
  }

  if (question.question_type === "select") {
    return (
      <label style={field}>
        {label}
        <select
          value={stringAnswer(answer)}
          onChange={(e) => onChange(e.target.value)}
          style={input}
        >
          <option value="">Select...</option>
          {question.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {question.help_text ? <span style={{ color: "#64748b", fontSize: 12 }}>{question.help_text}</span> : null}
      </label>
    );
  }

  if (question.question_type === "multi_select") {
    const selected = arrayAnswer(answer);
    return (
      <fieldset style={{ ...field, border: "1px solid #e5ebf5", borderRadius: 10, padding: 12 }}>
        <legend style={{ padding: "0 4px" }}>{label}</legend>
        {question.help_text ? <span style={{ color: "#64748b", fontSize: 12 }}>{question.help_text}</span> : null}
        {question.options.map((option) => (
          <label key={option.value} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(e) => {
                onChange(
                  e.target.checked
                    ? [...selected, option.value]
                    : selected.filter((item) => item !== option.value),
                );
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    );
  }

  if (question.question_type === "yes_no") {
    return (
      <fieldset style={{ ...field, border: "1px solid #e5ebf5", borderRadius: 10, padding: 12 }}>
        <legend style={{ padding: "0 4px" }}>{label}</legend>
        {question.help_text ? <span style={{ color: "#64748b", fontSize: 12 }}>{question.help_text}</span> : null}
        {[
          ["yes", "Yes"],
          ["no", "No"],
        ].map(([value, text]) => (
          <label key={value} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 500 }}>
            <input
              type="radio"
              name={question.question_key}
              value={value}
              checked={answer === value}
              onChange={() => onChange(value)}
            />
            {text}
          </label>
        ))}
      </fieldset>
    );
  }

  return (
    <label style={field}>
      {label}
      <input
        type={question.question_type === "date" ? "date" : question.question_type === "number" ? "number" : "text"}
        value={stringAnswer(answer)}
        onChange={(e) => onChange(e.target.value)}
        style={input}
      />
      {question.help_text ? <span style={{ color: "#64748b", fontSize: 12 }}>{question.help_text}</span> : null}
    </label>
  );
}

export function PreAuthEligibility() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"eligibility" | "account">(
    searchParams.get("signin") ? "account" : "eligibility",
  );
  const [form, setForm] = useState(initial);
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [answers, setAnswers] = useState<IntakeQuestionAnswers>({});
  const [questionLoadError, setQuestionLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("intake_questions")
        .select("id, question_key, prompt, help_text, question_type, required, options, position, is_active")
        .eq("audience", "pre_signup")
        .eq("is_active", true)
        .order("position", { ascending: true });

      if (cancelled) {
        return;
      }
      if (loadError) {
        setQuestionLoadError(loadError.message);
        return;
      }
      setQuestions((data ?? []) as IntakeQuestion[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (step === "account") {
    return <AuthEntry />;
  }

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      <section style={card}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700, color: "#172033" }}>
          Check eligibility
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
          Start with the basics. If eligible, you&apos;ll create an account before pharmacy search.
        </p>

        <form
          style={{ display: "grid", gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const state = form.service_state?.trim() ?? "";
            if (!form.for_self) {
              setError("This online flow currently supports patients booking for themselves.");
              return;
            }
            if (!state) {
              setError("Select the state where you will receive care.");
              return;
            }
            const unanswered = questions.find(
              (question) => !intakeAnswerComplete(question, answers[question.question_key]),
            );
            if (unanswered) {
              setError(`Answer: ${unanswered.prompt}`);
              return;
            }
            window.localStorage.setItem(
              PRE_AUTH_INTAKE_STORAGE_KEY,
              serializePreAuthIntake({
                ...form,
                service_state: state,
                address_state: state,
                pre_signup_answers: normalizeIntakeAnswers(questions, answers),
              }),
            );
            setStep("account");
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label style={field}>
              First name
              <input
                required
                autoComplete="given-name"
                value={form.legal_first_name}
                onChange={(e) => setForm((p) => ({ ...p, legal_first_name: e.target.value }))}
                style={input}
              />
            </label>
            <label style={field}>
              Last name
              <input
                required
                autoComplete="family-name"
                value={form.legal_last_name}
                onChange={(e) => setForm((p) => ({ ...p, legal_last_name: e.target.value }))}
                style={input}
              />
            </label>
          </div>

          <label style={field}>
            Date of birth
            <input
              required
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))}
              style={input}
            />
          </label>

          <label style={field}>
            Gender
            <select
              required
              value={form.gender}
              onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
              style={input}
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label>

          <label style={field}>
            State
            <select
              required
              value={form.service_state}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  service_state: e.target.value,
                  address_state: e.target.value,
                }))
              }
              style={input}
            >
              <option value="">Select state...</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ ...field, display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={form.for_self === true}
              onChange={(e) => setForm((p) => ({ ...p, for_self: e.target.checked }))}
            />
            I am booking care for myself
          </label>

          {questionLoadError ? (
            <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
              Intake questions could not load: {questionLoadError}
            </p>
          ) : null}

          {questions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              answer={answers[question.question_key]}
              onChange={(value) =>
                setAnswers((current) => ({
                  ...current,
                  [question.question_key]: value,
                }))
              }
            />
          ))}

          {error ? (
            <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            style={{
              marginTop: 4,
              padding: "12px 16px",
              borderRadius: 8,
              border: "none",
              background: "#172033",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Create account to continue
          </button>
          <button
            type="button"
            onClick={() => setStep("account")}
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              color: "#2563eb",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Already have an account? Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
