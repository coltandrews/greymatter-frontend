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
} from "@/lib/intake/preAuthIntake";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

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

const optionGrid = {
  display: "grid" as const,
  gap: 10,
  marginTop: 2,
};

const optionCard = {
  position: "relative" as const,
  minHeight: 46,
  display: "flex" as const,
  alignItems: "center",
  gap: 10,
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #dbe3ef",
  background: "#fff",
  color: "#172033",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const selectedOptionCard = {
  borderColor: "#172033",
  background: "#f8fafc",
  boxShadow: "0 6px 18px rgba(23, 32, 51, 0.08)",
};

const optionMark = {
  width: 20,
  height: 20,
  display: "inline-grid" as const,
  placeItems: "center",
  flexShrink: 0,
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#fff",
  fontSize: 12,
  fontWeight: 900,
};

const selectedOptionMark = {
  borderColor: "#172033",
  background: "#172033",
};

const pageSize = 1000;

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

function pageForPosition(position: number): number {
  return Math.max(1, Math.floor(Math.max(position, 0) / pageSize) + 1);
}

function groupQuestionsByPage(questions: IntakeQuestion[]): IntakeQuestion[][] {
  const groups = new Map<number, IntakeQuestion[]>();
  questions.forEach((question) => {
    const page = pageForPosition(question.position);
    groups.set(page, [...(groups.get(page) ?? []), question]);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, pageQuestions]) => pageQuestions);
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
      <fieldset style={{ ...field, border: "1px solid #e5ebf5", borderRadius: 14, padding: 14, background: "#ffffff" }}>
        <legend style={{ padding: "0 4px", fontWeight: 800 }}>{label}</legend>
        {question.help_text ? <span style={{ color: "#64748b", fontSize: 12 }}>{question.help_text}</span> : null}
        <div style={optionGrid}>
          {question.options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                style={{
                  ...optionCard,
                  ...(checked ? selectedOptionCard : {}),
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    onChange(
                      e.target.checked
                        ? [...selected, option.value]
                        : selected.filter((item) => item !== option.value),
                    );
                  }}
                  style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                />
                <span style={{ ...optionMark, ...(checked ? selectedOptionMark : {}) }}>
                  {checked ? "✓" : ""}
                </span>
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (question.question_type === "yes_no") {
    return (
      <fieldset style={{ ...field, border: "1px solid #e5ebf5", borderRadius: 14, padding: 14, background: "#ffffff" }}>
        <legend style={{ padding: "0 4px", fontWeight: 800 }}>{label}</legend>
        {question.help_text ? <span style={{ color: "#64748b", fontSize: 12 }}>{question.help_text}</span> : null}
        <div style={{ ...optionGrid, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {[
            ["yes", "Yes"],
            ["no", "No"],
          ].map(([value, text]) => {
            const checked = answer === value;
            return (
              <label
                key={value}
                style={{
                  ...optionCard,
                  justifyContent: "center",
                  ...(checked ? selectedOptionCard : {}),
                }}
              >
                <input
                  type="radio"
                  name={question.question_key}
                  value={value}
                  checked={checked}
                  onChange={() => onChange(value)}
                  style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                />
                <span style={{ ...optionMark, ...(checked ? selectedOptionMark : {}) }}>
                  {checked ? "✓" : ""}
                </span>
                <span>{text}</span>
              </label>
            );
          })}
        </div>
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
  const startsInSignIn = Boolean(searchParams.get("signin"));
  const [step, setStep] = useState<"eligibility" | "account">(startsInSignIn ? "account" : "eligibility");
  const [accountMode, setAccountMode] = useState<"signup" | "signin">(startsInSignIn ? "signin" : "signup");
  const questions = mergePreSignupQuestions([]);
  const [answers, setAnswers] = useState<IntakeQuestionAnswers>({});
  const [intakePageIndex, setIntakePageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const questionPages = groupQuestionsByPage(questions);
  const currentQuestions = questionPages[intakePageIndex] ?? questionPages[0] ?? [];
  const hasNextQuestionPage = intakePageIndex < questionPages.length - 1;

  if (step === "account") {
    return <AuthEntry initialMode={accountMode} />;
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
            const unanswered = currentQuestions.find(
              (question) => !intakeAnswerComplete(question, answers[question.question_key]),
            );
            if (unanswered) {
              setError(`Answer: ${unanswered.prompt}`);
              return;
            }
            if (hasNextQuestionPage) {
              setIntakePageIndex((current) => current + 1);
              return;
            }

            const firstName = stringAnswer(answers.legal_first_name).trim();
            const lastName = stringAnswer(answers.legal_last_name).trim();
            const dateOfBirth = stringAnswer(answers.date_of_birth).trim();
            const gender = stringAnswer(answers.gender).trim();
            const state = stringAnswer(answers.service_state).trim();
            const forSelf = stringAnswer(answers.for_self) === "yes";

            const unansweredAnyPage = questions.find(
              (question) => !intakeAnswerComplete(question, answers[question.question_key]),
            );
            if (unansweredAnyPage) {
              setError(`Answer: ${unansweredAnyPage.prompt}`);
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
            setAccountMode("signup");
            setStep("account");
          }}
        >
          {questionPages.length > 1 ? (
            <p style={{ margin: "-4px 0 2px", color: "#64748b", fontSize: 13, fontWeight: 700 }}>
              Step {intakePageIndex + 1} of {questionPages.length}
            </p>
          ) : null}

          {currentQuestions.map((question) => (
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
            {hasNextQuestionPage ? "Next step" : "Continue"}
          </button>
          {intakePageIndex > 0 ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIntakePageIndex((current) => Math.max(0, current - 1));
              }}
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
              Back to previous step
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setAccountMode("signin");
              setStep("account");
            }}
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
