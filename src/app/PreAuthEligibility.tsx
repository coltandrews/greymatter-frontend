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
  maxWidth: 380,
  minHeight: "calc(100vh - 56px)",
  display: "grid" as const,
  gridTemplateRows: "auto minmax(0, 1fr)",
};

const brand = {
  graphite: "#121212",
  surface: "#171717",
  surface2: "#454545",
  text: "#f2f2f2",
  muted: "#c9c9c9",
  quiet: "#858585",
  border: "#d8d8d8",
  accent: "#3487ed",
};

const field = {
  display: "grid" as const,
  gap: 12,
  fontSize: 15,
  fontWeight: 400,
  color: brand.text,
};

const input = {
  minHeight: 48,
  padding: "0 20px",
  borderRadius: 7,
  border: `2px solid ${brand.border}`,
  fontSize: 16,
  background: "transparent",
  color: brand.text,
  outlineColor: brand.accent,
};

const flowActions = {
  display: "grid" as const,
  gap: 12,
  marginTop: "auto",
  paddingTop: 36,
};

const primaryAction = {
  width: "100%",
  minHeight: 50,
  padding: "0 18px",
  borderRadius: 0,
  border: "none",
  background: brand.accent,
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 500,
  textTransform: "uppercase" as const,
};

const linkButton = {
  padding: 0,
  border: "none",
  background: "transparent",
  color: brand.muted,
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};

const optionGrid = {
  display: "grid" as const,
  gap: 10,
  marginTop: 2,
};

const optionCard = {
  position: "relative" as const,
  minHeight: 50,
  display: "flex" as const,
  alignItems: "center",
  gap: 12,
  padding: "0 22px",
  borderRadius: 7,
  border: "none",
  background: brand.surface2,
  color: brand.text,
  fontSize: 15,
  fontWeight: 400,
  cursor: "pointer",
};

const selectedOptionCard = {
  background: brand.accent,
  boxShadow: "none",
};

const optionMark = {
  width: 0,
  height: 0,
  display: "none" as const,
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
  borderColor: "#ffffff",
  background: "#ffffff",
};

const flowHeader = {
  position: "relative" as const,
  display: "grid" as const,
  justifyItems: "center",
  gap: 28,
  paddingTop: 8,
  marginBottom: 56,
};

const backArrow = {
  position: "absolute" as const,
  left: 0,
  top: 64,
  border: "none",
  background: "transparent",
  color: brand.text,
  fontSize: 25,
  lineHeight: 1,
  cursor: "pointer",
};

const progressTrack = {
  width: "100%",
  height: 4,
  borderRadius: 999,
  background: "#666666",
  overflow: "hidden",
};

const progressFill = {
  height: "100%",
  borderRadius: 999,
  background: brand.accent,
  transition: "width 160ms ease",
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

function groupQuestionsByPage(questions: IntakeQuestion[]): IntakeQuestion[][] {
  return [...questions]
    .sort((a, b) => a.position - b.position)
    .map((question) => [question]);
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
          style={{ ...input, minHeight: 134, paddingTop: 16, resize: "vertical" }}
        />
        {question.help_text ? <span style={{ color: brand.quiet, fontSize: 13 }}>{question.help_text}</span> : null}
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
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {question.help_text ? <span style={{ color: brand.quiet, fontSize: 13 }}>{question.help_text}</span> : null}
      </label>
    );
  }

  if (question.question_type === "multi_select") {
    const selected = arrayAnswer(answer);
    return (
      <fieldset style={{ ...field, border: "none", padding: 0, margin: 0 }}>
        <legend style={{ padding: 0, marginBottom: 12, fontWeight: 400 }}>{label}</legend>
        {question.help_text ? <span style={{ color: brand.quiet, fontSize: 13 }}>{question.help_text}</span> : null}
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
                  {checked ? "" : ""}
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
      <fieldset style={{ ...field, border: "none", padding: 0, margin: 0 }}>
        <legend style={{ padding: 0, marginBottom: 12, fontWeight: 400 }}>{label}</legend>
        {question.help_text ? <span style={{ color: brand.quiet, fontSize: 13 }}>{question.help_text}</span> : null}
        <div style={optionGrid}>
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
                  {checked ? "" : ""}
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
      {question.help_text ? <span style={{ color: brand.quiet, fontSize: 13 }}>{question.help_text}</span> : null}
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
  const totalFlowSteps = questionPages.length + 3;
  const currentFlowStep =
    step === "eligibility"
      ? intakePageIndex + 1
      : step === "treatment"
        ? questionPages.length + 1
        : step === "treatment_questions"
          ? questionPages.length + 2
          : totalFlowSteps;
  const progressPercent = Math.min(
    100,
    Math.max(8, (currentFlowStep / totalFlowSteps) * 100),
  );
  const canGoBack =
    (step === "eligibility" && intakePageIndex > 0) ||
    step === "treatment" ||
    step === "treatment_questions";

  function goBack() {
    setError(null);
    if (step === "treatment_questions") {
      setStep("treatment");
      return;
    }
    if (step === "treatment") {
      setStep("eligibility");
      setIntakePageIndex(Math.max(0, questionPages.length - 1));
      return;
    }
    setIntakePageIndex((current) => Math.max(0, current - 1));
  }

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
        justifyItems: "center",
        alignItems: "start",
        padding: "28px 20px",
        minHeight: "100vh",
        background: brand.graphite,
      }}
    >
      <section style={card}>
        <header style={flowHeader}>
          {canGoBack ? (
            <button type="button" onClick={goBack} style={backArrow} aria-label="Back">
              ←
            </button>
          ) : null}
          <img
            src="/brand/gmmd-logo-color-transparent.png"
            alt="GMMD"
            style={{
              display: "block",
              width: 116,
              maxWidth: "42%",
              height: "auto",
            }}
          />
          <div style={progressTrack} aria-hidden="true">
            <div style={{ ...progressFill, width: `${progressPercent}%` }} />
          </div>
        </header>

        <div style={{ display: "grid", minHeight: 0 }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 22, lineHeight: 1.1, fontWeight: 400, color: brand.text }}>
            {heading}
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: 15, color: brand.muted, lineHeight: 1.35 }}>
            {lead}
          </p>

        {step === "eligibility" ? (
          <form
            style={{ display: "grid", gap: 0, minHeight: "52vh" }}
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
              <p style={{ margin: "-12px 0 20px", color: brand.quiet, fontSize: 13, fontWeight: 400 }}>
                Question {intakePageIndex + 1} of {questionPages.length}
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
              <button
                type="submit"
                disabled={!currentPageComplete}
                style={{
                  ...primaryAction,
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
              style={{ ...linkButton, justifySelf: "center", marginTop: 14 }}
            >
              Already have an account? Sign in
            </button>
          </form>
        ) : null}

        {step === "treatment" ? (
          <div style={{ display: "grid", gap: 0, minHeight: "52vh" }}>
            <div
              style={{
                display: "grid",
                gap: 12,
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
                      gap: 0,
                      minHeight: 50,
                      padding: "0 22px",
                      textAlign: "left",
                      borderRadius: 7,
                      border: "none",
                      background: selected ? brand.accent : brand.surface2,
                      color: brand.text,
                      cursor: "pointer",
                      boxShadow: "none",
                      alignItems: "center",
                    }}
                    aria-pressed={selected}
                  >
                    <strong style={{ fontSize: 15, fontWeight: 400 }}>{treatment.name}</strong>
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
                disabled={!selectedTreatment}
                style={{
                  ...primaryAction,
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
            style={{ display: "grid", gap: 0, minHeight: "52vh" }}
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
                type="submit"
                disabled={!medicationQuestionsComplete}
                style={{
                  ...primaryAction,
                  cursor: medicationQuestionsComplete ? "pointer" : "not-allowed",
                  opacity: medicationQuestionsComplete ? 1 : 0.55,
                }}
              >
                Create account
              </button>
            </div>
          </form>
        ) : null}
        </div>
      </section>
    </main>
  );
}
