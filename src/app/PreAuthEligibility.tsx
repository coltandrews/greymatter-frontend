"use client";

import { AuthEntry } from "./AuthEntry";
import { US_STATES } from "./intake/usStates";
import {
  intakeAnswerComplete,
  isCorePreSignupQuestionKey,
  mergePreSignupQuestions,
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

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-Binary" },
  { value: "prefer_not", label: "Prefer Not To Say" },
];

function stringAnswer(value: IntakeQuestionAnswer | undefined): string {
  return typeof value === "string" ? value : "";
}

function arrayAnswer(value: IntakeQuestionAnswer | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function optionsForQuestion(question: IntakeQuestion) {
  if (question.question_key === "service_state" && question.options.length === 0) {
    return US_STATES.map((state) => ({
      value: state.code,
      label: state.name,
    }));
  }
  if (question.question_key === "gender" && question.options.length === 0) {
    return genderOptions;
  }
  return question.options;
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
    const options = optionsForQuestion(question);
    return (
      <label style={field}>
        {label}
        <select
          value={stringAnswer(answer)}
          onChange={(e) => onChange(e.target.value)}
          style={input}
        >
          <option value="">Select...</option>
          {options.map((option) => (
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
  const [questions, setQuestions] = useState<IntakeQuestion[]>(
    mergePreSignupQuestions([]),
  );
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
      setQuestions(mergePreSignupQuestions((data ?? []) as IntakeQuestion[]));
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
            const firstName = stringAnswer(answers.legal_first_name).trim();
            const lastName = stringAnswer(answers.legal_last_name).trim();
            const dateOfBirth = stringAnswer(answers.date_of_birth).trim();
            const gender = stringAnswer(answers.gender).trim();
            const state = stringAnswer(answers.service_state).trim();
            const forSelf = stringAnswer(answers.for_self) === "yes";

            const unanswered = questions.find(
              (question) => !intakeAnswerComplete(question, answers[question.question_key]),
            );
            if (unanswered) {
              setError(`Answer: ${unanswered.prompt}`);
              return;
            }
            if (!forSelf) {
              setError("This online flow currently supports patients booking for themselves.");
              return;
            }
            if (!state) {
              setError("Select the state where you will receive care.");
              return;
            }
            const extraQuestions = questions.filter(
              (question) => !isCorePreSignupQuestionKey(question.question_key),
            );
            window.localStorage.setItem(
              PRE_AUTH_INTAKE_STORAGE_KEY,
              serializePreAuthIntake({
                legal_first_name: firstName,
                legal_last_name: lastName,
                date_of_birth: dateOfBirth,
                gender,
                service_state: state,
                address_state: state,
                for_self: true,
                pre_signup_answers: normalizeIntakeAnswers(extraQuestions, answers),
              }),
            );
            setStep("account");
          }}
        >
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
