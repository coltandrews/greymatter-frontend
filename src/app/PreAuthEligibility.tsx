"use client";

import { AuthEntry } from "./AuthEntry";
import { US_STATES } from "./intake/usStates";
import {
  intakeAnswerComplete,
  mergePreSignupQuestions,
  type IntakeQuestion,
  type IntakeQuestionAnswer,
  type IntakeQuestionAnswers,
} from "@/lib/intake/intakeQuestions";
import {
  PRE_AUTH_INTAKE_STORAGE_KEY,
  buildPreAuthIntakeData,
  serializePreAuthIntake,
} from "@/lib/intake/preAuthIntake";
import {
  TREATMENTS,
  treatmentQuestions,
  type TreatmentKey,
} from "@/lib/treatments";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const card = {
  width: "100%" as const,
  maxWidth: 760,
  padding: 30,
  background: "rgba(12, 17, 22, 0.94)",
  borderRadius: 8,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  boxShadow: "0 34px 90px rgba(0, 0, 0, 0.42)",
};

const brand = {
  graphite: "#07090d",
  surface: "#0c1116",
  surface2: "#111922",
  text: "#eef3f8",
  muted: "#8f9ba8",
  border: "rgba(148, 163, 184, 0.18)",
  accent: "#73d2ff",
  mint: "#7dd3b0",
};

const field = {
  display: "grid" as const,
  gap: 6,
  fontSize: 14,
  fontWeight: 600,
  color: brand.text,
};

const input = {
  padding: "11px 12px",
  borderRadius: 8,
  border: `1px solid ${brand.border}`,
  fontSize: 16,
  background: "#090d12",
  color: brand.text,
  outlineColor: brand.accent,
};

const flowActions = {
  display: "flex" as const,
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap" as const,
  marginTop: 4,
};

const primaryAction = {
  padding: "12px 16px",
  borderRadius: 8,
  border: "none",
  background: brand.accent,
  color: "#061016",
  fontSize: 16,
  fontWeight: 800,
};

const linkButton = {
  padding: 0,
  border: "none",
  background: "transparent",
  color: brand.accent,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
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
  borderRadius: 8,
  border: `1px solid ${brand.border}`,
  background: brand.surface2,
  color: brand.text,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const selectedOptionCard = {
  borderColor: brand.accent,
  background: "#101d27",
  boxShadow: "0 0 0 1px rgba(115, 210, 255, 0.22)",
};

const optionMark = {
  width: 20,
  height: 20,
  display: "inline-grid" as const,
  placeItems: "center",
  flexShrink: 0,
  borderRadius: 999,
  border: "1px solid rgba(148, 163, 184, 0.34)",
  background: "#080c11",
  color: "#061016",
  fontSize: 12,
  fontWeight: 900,
};

const selectedOptionMark = {
  borderColor: brand.accent,
  background: brand.accent,
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
        {question.help_text ? <span style={{ color: brand.muted, fontSize: 12 }}>{question.help_text}</span> : null}
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
        {question.help_text ? <span style={{ color: brand.muted, fontSize: 12 }}>{question.help_text}</span> : null}
      </label>
    );
  }

  if (question.question_type === "multi_select") {
    const selected = arrayAnswer(answer);
    return (
      <fieldset style={{ ...field, border: `1px solid ${brand.border}`, borderRadius: 8, padding: 14, background: "#090d12" }}>
        <legend style={{ padding: "0 4px", fontWeight: 800 }}>{label}</legend>
        {question.help_text ? <span style={{ color: brand.muted, fontSize: 12 }}>{question.help_text}</span> : null}
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
      <fieldset style={{ ...field, border: `1px solid ${brand.border}`, borderRadius: 8, padding: 14, background: "#090d12" }}>
        <legend style={{ padding: "0 4px", fontWeight: 800 }}>{label}</legend>
        {question.help_text ? <span style={{ color: brand.muted, fontSize: 12 }}>{question.help_text}</span> : null}
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
      {question.help_text ? <span style={{ color: brand.muted, fontSize: 12 }}>{question.help_text}</span> : null}
    </label>
  );
}

export function PreAuthEligibility() {
  const searchParams = useSearchParams();
  const startsInSignIn = Boolean(searchParams.get("signin"));
  const [step, setStep] = useState<
    "eligibility" | "treatment" | "treatment_questions" | "account"
  >(startsInSignIn ? "account" : "eligibility");
  const [accountMode, setAccountMode] = useState<"signup" | "signin">(startsInSignIn ? "signin" : "signup");
  const questions = mergePreSignupQuestions([]);
  const [answers, setAnswers] = useState<IntakeQuestionAnswers>({});
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentKey | null>(null);
  const [treatmentAnswers, setTreatmentAnswers] = useState<IntakeQuestionAnswers>({});
  const [intakePageIndex, setIntakePageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const questionPages = groupQuestionsByPage(questions);
  const currentQuestions = questionPages[intakePageIndex] ?? questionPages[0] ?? [];
  const hasNextQuestionPage = intakePageIndex < questionPages.length - 1;
  const currentPageComplete = currentQuestions.every((question) =>
    intakeAnswerComplete(question, answers[question.question_key]),
  );
  const medicationQuestions = treatmentQuestions(selectedTreatment);
  const medicationQuestionsComplete = medicationQuestions.every((question) =>
    intakeAnswerComplete(question, treatmentAnswers[question.question_key]),
  );

  function saveIntakeAndContinue() {
    const intake = buildPreAuthIntakeData(questions, answers, {
      selectedTreatment,
      questions: medicationQuestions,
      answers: treatmentAnswers,
    });
    window.localStorage.setItem(
      PRE_AUTH_INTAKE_STORAGE_KEY,
      serializePreAuthIntake(intake),
    );
    setAccountMode("signup");
    setStep("account");
  }

  if (step === "account") {
    return <AuthEntry initialMode={accountMode} intakeReady />;
  }

  const heading =
    step === "treatment"
      ? "Choose treatment"
      : step === "treatment_questions"
        ? `${TREATMENTS.find((treatment) => treatment.key === selectedTreatment)?.name ?? "Treatment"} intake`
        : "Check eligibility";
  const lead =
    step === "treatment"
      ? "Select the care path you want reviewed by a licensed provider."
      : step === "treatment_questions"
        ? "Answer the treatment-specific questions before creating your account."
        : "Start with demographics and basic health information. Your answers attach to your account after signup.";

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        minHeight: "100vh",
        background: `linear-gradient(180deg, rgba(7, 9, 13, 0.86), rgba(7, 9, 13, 0.96)), url('/textures/graphite-texture.jpeg') center / cover fixed`,
      }}
    >
      <section style={card}>
        <img
          src="/brand/gmmd-logo-light.jpeg"
          alt="GMMD"
          style={{ display: "block", width: 176, maxWidth: "100%", marginBottom: 28 }}
        />
        <h1 style={{ margin: "0 0 8px", fontSize: 30, fontWeight: 850, color: brand.text }}>
          {heading}
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 15, color: brand.muted, lineHeight: 1.55 }}>
          {lead}
        </p>

        {step === "eligibility" ? (
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

              const intake = buildPreAuthIntakeData(questions, answers);

              const unansweredAnyPage = questions.find(
                (question) => !intakeAnswerComplete(question, answers[question.question_key]),
              );
              if (unansweredAnyPage) {
                setError(`Answer: ${unansweredAnyPage.prompt}`);
                return;
              }
              if (intake.for_self !== true) {
                setError("This online flow currently supports patients booking for themselves.");
                return;
              }
              if (!intake.service_state) {
                setError("Select the state where you will receive care.");
                return;
              }
              setStep("treatment");
            }}
          >
            {questionPages.length > 1 ? (
              <p style={{ margin: "-4px 0 2px", color: brand.muted, fontSize: 13, fontWeight: 700 }}>
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
              <p role="alert" style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>
                {error}
              </p>
            ) : null}

            <div style={flowActions}>
              {intakePageIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setIntakePageIndex((current) => Math.max(0, current - 1));
                  }}
                  style={linkButton}
                >
                  ← Back to previous step
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
              <button
                type="submit"
                disabled={!currentPageComplete}
                style={{
                  ...primaryAction,
                  marginLeft: "auto",
                  cursor: currentPageComplete ? "pointer" : "not-allowed",
                  opacity: currentPageComplete ? 1 : 0.55,
                }}
              >
                {hasNextQuestionPage ? "Next step" : "Choose treatment"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setAccountMode("signin");
                setStep("account");
              }}
              style={linkButton}
            >
              Already have an account? Sign in
            </button>
          </form>
        ) : null}

        {step === "treatment" ? (
          <div style={{ display: "grid", gap: 18 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 14,
              }}
            >
              {TREATMENTS.map((treatment) => {
                const selected = selectedTreatment === treatment.key;
                return (
                  <button
                    key={treatment.key}
                    type="button"
                    onClick={() => {
                      setSelectedTreatment(treatment.key);
                      setTreatmentAnswers({});
                    }}
                    style={{
                      display: "grid",
                      gap: 12,
                      minHeight: 210,
                      padding: 18,
                      textAlign: "left",
                      borderRadius: 8,
                      border: `1px solid ${selected ? brand.accent : brand.border}`,
                      background: selected ? "#101d27" : brand.surface2,
                      color: brand.text,
                      cursor: "pointer",
                      boxShadow: selected ? "0 0 0 1px rgba(115, 210, 255, 0.22)" : "none",
                    }}
                    aria-pressed={selected}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 52,
                        height: 52,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 8,
                        background: selected ? brand.accent : "#07090d",
                        color: selected ? "#061016" : brand.text,
                        fontSize: 26,
                        fontWeight: 900,
                      }}
                    >
                      {treatment.accent}
                    </span>
                    <span style={{ display: "grid", gap: 5 }}>
                      <strong style={{ fontSize: 20 }}>{treatment.name}</strong>
                      <span style={{ fontSize: 13, fontWeight: 800, color: selected ? brand.accent : brand.mint }}>
                        {treatment.label}
                      </span>
                      <span style={{ fontSize: 14, lineHeight: 1.45, color: brand.muted }}>
                        {treatment.summary}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {error ? (
              <p role="alert" style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>
                {error}
              </p>
            ) : null}
            <div style={flowActions}>
              <button
                type="button"
                style={linkButton}
                onClick={() => {
                  setError(null);
                  setStep("eligibility");
                }}
              >
                ← Back to basics
              </button>
              <button
                type="button"
                disabled={!selectedTreatment}
                style={{
                  ...primaryAction,
                  marginLeft: "auto",
                  cursor: selectedTreatment ? "pointer" : "not-allowed",
                  opacity: selectedTreatment ? 1 : 0.55,
                }}
                onClick={() => {
                  if (!selectedTreatment) {
                    setError("Select a treatment.");
                    return;
                  }
                  setError(null);
                  setStep("treatment_questions");
                }}
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === "treatment_questions" ? (
          <form
            style={{ display: "grid", gap: 14 }}
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              const unanswered = medicationQuestions.find(
                (question) => !intakeAnswerComplete(question, treatmentAnswers[question.question_key]),
              );
              if (unanswered) {
                setError(`Answer: ${unanswered.prompt}`);
                return;
              }
              saveIntakeAndContinue();
            }}
          >
            {medicationQuestions.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                answer={treatmentAnswers[question.question_key]}
                onChange={(value) =>
                  setTreatmentAnswers((current) => ({
                    ...current,
                    [question.question_key]: value,
                  }))
                }
              />
            ))}
            {error ? (
              <p role="alert" style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>
                {error}
              </p>
            ) : null}
            <div style={flowActions}>
              <button
                type="button"
                style={linkButton}
                onClick={() => {
                  setError(null);
                  setStep("treatment");
                }}
              >
                ← Back to treatment
              </button>
              <button
                type="submit"
                disabled={!medicationQuestionsComplete}
                style={{
                  ...primaryAction,
                  marginLeft: "auto",
                  cursor: medicationQuestionsComplete ? "pointer" : "not-allowed",
                  opacity: medicationQuestionsComplete ? 1 : 0.55,
                }}
              >
                Create account
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
}
