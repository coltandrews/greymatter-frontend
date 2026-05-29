"use client";

import { AuthEntry } from "./AuthEntry";
import { US_STATES } from "./intake/usStates";
import { createClient } from "@/lib/supabase/client";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { persistPreAuthIntake } from "@/lib/intake/persistPreAuthIntake";
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
  PATIENT_TREATMENTS,
  TREATMENTS,
  visibleTreatmentQuestions,
  type TreatmentKey,
} from "@/lib/treatments";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type KeyboardEvent } from "react";

const card = {
  width: "100%" as const,
  maxWidth: 408,
  minWidth: 0,
  minHeight: "auto",
  display: "grid" as const,
};

const brand = {
  graphite: "var(--gm-page-bg)",
  surface: "#ffffff",
  surface2: "var(--gm-control-bg)",
  text: "#171717",
  muted: "#242424",
  quiet: "#3f3f3f",
  border: "#171717",
  accent: "#171717",
  actionBg: "#171717",
  actionText: "#ffffff",
  disabledBg: "var(--gm-disabled-bg)",
  disabledText: "#4a4a4a",
  error: "#b91c1c",
};

const field = {
  display: "grid" as const,
  minWidth: 0,
  gap: 12,
  fontSize: 15,
  fontWeight: 400,
  color: brand.text,
};

const input = {
  width: "100%" as const,
  minWidth: 0,
  minHeight: 54,
  padding: "0 20px",
  borderRadius: 7,
  border: `2px solid ${brand.border}`,
  fontSize: 16,
  background: brand.surface2,
  color: brand.text,
  outlineColor: "#171717",
};

const flowActions = {
  display: "grid" as const,
  gap: 12,
  marginTop: 32,
};

const primaryAction = {
  width: "100%",
  minHeight: 52,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid #171717",
  background: brand.actionBg,
  color: brand.actionText,
  fontSize: 15,
  fontWeight: 600,
  boxShadow: "0 10px 22px rgba(23, 23, 23, 0.14)",
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
  minWidth: 0,
  gap: 10,
  marginTop: 2,
};

const optionCard = {
  position: "relative" as const,
  width: "100%" as const,
  minWidth: 0,
  minHeight: 58,
  display: "flex" as const,
  alignItems: "center",
  gap: 12,
  padding: "0 22px",
  borderRadius: 7,
  border: "1px solid rgba(23, 23, 23, 0.72)",
  background: brand.surface2,
  color: brand.text,
  fontSize: 15,
  fontWeight: 400,
  cursor: "pointer",
};

const selectedOptionCard = {
  background: brand.accent,
  color: "#ffffff",
  borderColor: brand.accent,
  boxShadow: "none",
};

const optionMark = {
  width: 0,
  height: 0,
  display: "none" as const,
  placeItems: "center",
  flexShrink: 0,
  borderRadius: 999,
  border: "1px solid rgba(23, 23, 23, 0.34)",
  background: "#ffffff",
  color: brand.text,
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
  gap: 24,
  paddingTop: 8,
  marginBottom: 44,
};

const backArrow = {
  position: "absolute" as const,
  left: 0,
  top: 64,
  padding: 0,
  border: "none",
  width: 28,
  height: 28,
  display: "grid" as const,
  placeItems: "center",
  appearance: "none" as const,
  borderRadius: 0,
  background: "transparent",
  color: brand.text,
  fontSize: 18,
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontWeight: 500,
  lineHeight: 1,
  cursor: "pointer",
};

const backArrowGlyph = {
  display: "block",
  lineHeight: 1,
  transform: "translateY(-1px)",
};

const progressTrack = {
  width: "100%",
  height: 4,
  borderRadius: 999,
  background: "var(--gm-rule)",
  overflow: "hidden",
};

const progressFill = {
  height: "100%",
  borderRadius: 999,
  background: brand.accent,
  transition: "width 160ms ease",
};

const loggedInNote = {
  margin: "0 0 18px",
  padding: "12px 14px",
  borderRadius: 7,
  background: "rgba(255, 255, 255, 0.62)",
  border: "1px solid rgba(23, 23, 23, 0.2)",
  color: brand.muted,
  fontSize: 13,
  lineHeight: 1.45,
};

const bmiCard = {
  display: "flex" as const,
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  margin: "2px 0 4px",
  padding: "14px 16px",
  borderRadius: 7,
  background: "#eaf3ff",
  color: brand.text,
};

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const heightFeetOptions = Array.from({ length: 7 }, (_, index) => index + 3);
const heightInchOptions = Array.from({ length: 12 }, (_, index) => index);

function stringAnswer(value: IntakeQuestionAnswer | undefined): string {
  return typeof value === "string" ? value : "";
}

function arrayAnswer(value: IntakeQuestionAnswer | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function defaultTreatmentAnswers(treatmentKey: TreatmentKey): IntakeQuestionAnswers {
  if (treatmentKey === "glp_1") {
    return {
      glp_1_goal_weight: "0",
    };
  }
  return {};
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

function questionCanAutoAdvance(question: IntakeQuestion): boolean {
  // Auto-advance is intentionally paused for now. It made select/radio steps feel
  // jumpy, especially around medication selection. Keep the previous rule here so
  // we can re-enable it deliberately later.
  // return question.question_type === "yes_no" || question.question_type === "select";
  void question;
  return false;
}

function shouldSubmitOnEnter(event: KeyboardEvent<HTMLElement>): boolean {
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.nativeEvent.isComposing
  ) {
    return false;
  }
  const target = event.target;
  return !(target instanceof HTMLTextAreaElement);
}

function answersFromPatientData(data: IntakeDraftData | null | undefined): IntakeQuestionAnswers {
  if (!data) {
    return {};
  }
  const state = data.service_state?.trim() || data.address_state?.trim() || "";
  return {
    legal_first_name: data.legal_first_name?.trim() ?? "",
    legal_last_name: data.legal_last_name?.trim() ?? "",
    date_of_birth: data.date_of_birth?.trim() ?? "",
    gender: data.gender?.trim() ?? "",
    service_state: state,
    for_self: data.for_self === false ? "no" : "yes",
    ...(data.pre_signup_answers ?? {}),
  };
}

function mergeSavedPatientData(
  base: IntakeDraftData | null | undefined,
  intake: IntakeDraftData,
): IntakeDraftData {
  return {
    ...(base ?? {}),
    ...intake,
    phone: intake.phone ?? base?.phone,
    phone_secondary: intake.phone_secondary ?? base?.phone_secondary,
    street_address: intake.street_address ?? base?.street_address,
    address_line2: intake.address_line2 ?? base?.address_line2,
    city: intake.city ?? base?.city,
    zip: intake.zip ?? base?.zip,
    country: intake.country ?? base?.country,
  };
}

function parseHeightInches(value: IntakeQuestionAnswer | undefined): number | null {
  const raw = stringAnswer(value).trim().toLowerCase();
  if (!raw) {
    return null;
  }

  const feetInches = raw.match(/^(\d+)\s*(?:'|ft|feet|\s)\s*(\d{1,2})?\s*(?:"|in|inches)?$/);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = feetInches[2] ? Number(feetInches[2]) : 0;
    if (feet >= 3 && feet <= 8 && inches >= 0 && inches < 12) {
      return feet * 12 + inches;
    }
  }

  const numeric = Number(raw.replace(/[^\d.]/g, ""));
  if (numeric >= 36 && numeric <= 108) {
    return numeric;
  }
  return null;
}

function calculateBmi(height: IntakeQuestionAnswer | undefined, weight: IntakeQuestionAnswer | undefined) {
  const inches = parseHeightInches(height);
  const pounds = Number(stringAnswer(weight).replace(/[^\d.]/g, ""));
  if (!inches || !Number.isFinite(pounds) || pounds <= 0) {
    return null;
  }
  const value = (pounds / (inches * inches)) * 703;
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

function bmiLabel(value: number) {
  if (value < 18.5) {
    return "Below range";
  }
  if (value < 25) {
    return "Standard range";
  }
  if (value < 30) {
    return "Elevated range";
  }
  return "Clinical range";
}

function BmiPreview({ answers }: { answers: IntakeQuestionAnswers }) {
  const bmi = calculateBmi(
    answers.glp_1_current_height,
    answers.glp_1_current_weight,
  );
  if (!bmi) {
    return null;
  }
  return (
    <div style={bmiCard} aria-live="polite">
      <span style={{ display: "grid", gap: 3 }}>
        <span style={{ color: brand.muted, fontSize: 13 }}>BMI</span>
        <strong style={{ fontSize: 26, lineHeight: 1, fontWeight: 500 }}>
          {bmi.toFixed(1)}
        </strong>
      </span>
      <span style={{ color: "#2563eb", fontSize: 14, fontWeight: 500 }}>
        {bmiLabel(bmi)}
      </span>
    </div>
  );
}

function HeightPicker({
  answer,
  label,
  onChange,
}: {
  answer: IntakeQuestionAnswer | undefined;
  label: React.ReactNode;
  onChange: (value: IntakeQuestionAnswer) => void;
}) {
  const totalInches = parseHeightInches(answer);
  const selectedFeet = totalInches ? Math.floor(totalInches / 12) : "";
  const selectedInches = totalInches ? totalInches % 12 : "";
  const inchOptions =
    selectedFeet === 9 ? [0] : heightInchOptions;

  function updateHeight(feetValue: string, inchesValue: string) {
    if (!feetValue) {
      onChange("");
      return;
    }
    const feet = Number(feetValue);
    const inches = Math.min(Number(inchesValue || "0"), feet === 9 ? 0 : 11);
    onChange(String(feet * 12 + inches));
  }

  return (
    <fieldset style={{ ...field, border: "none", padding: 0, margin: 0, minInlineSize: 0 }}>
      {label ? <legend style={{ padding: 0, marginBottom: 12, fontWeight: 400 }}>{label}</legend> : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ ...field, gap: 8, fontSize: 13, color: brand.muted }}>
          Feet
          <select
            value={selectedFeet}
            onChange={(e) => updateHeight(e.target.value, String(selectedInches))}
            style={input}
          >
            <option value="">Feet</option>
            {heightFeetOptions.map((feet) => (
              <option key={feet} value={feet}>
                {feet}
              </option>
            ))}
          </select>
        </label>
        <label style={{ ...field, gap: 8, fontSize: 13, color: brand.muted }}>
          Inches
          <select
            value={selectedInches}
            onChange={(e) => updateHeight(String(selectedFeet), e.target.value)}
            style={input}
            disabled={!selectedFeet}
          >
            <option value="">Inches</option>
            {inchOptions.map((inches) => (
              <option key={inches} value={inches}>
                {inches}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

function QuestionField({
  answer,
  hidePrompt = false,
  onChange,
  question,
}: {
  answer: IntakeQuestionAnswer | undefined;
  hidePrompt?: boolean;
  onChange: (value: IntakeQuestionAnswer) => void;
  question: IntakeQuestion;
}) {
  const label = hidePrompt ? null : (
    <>
      {question.prompt}
      {question.required ? " *" : ""}
    </>
  );

  if (question.question_key === "glp_1_current_height") {
    return (
      <HeightPicker
        answer={answer}
        label={label}
        onChange={onChange}
      />
    );
  }

  if (question.question_type === "textarea") {
    return (
      <label style={field}>
        {label}
        <textarea
          aria-label={question.prompt}
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
          aria-label={question.prompt}
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
      <fieldset style={{ ...field, border: "none", padding: 0, margin: 0, minInlineSize: 0 }}>
        {label ? <legend style={{ padding: 0, marginBottom: 12, fontWeight: 400 }}>{label}</legend> : null}
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
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (question.question_type === "yes_no") {
    return (
      <fieldset style={{ ...field, border: "none", padding: 0, margin: 0, minInlineSize: 0 }}>
        {label ? <legend style={{ padding: 0, marginBottom: 12, fontWeight: 400 }}>{label}</legend> : null}
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
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{text}</span>
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
        aria-label={question.prompt}
        type={question.question_type === "date" ? "date" : question.question_type === "number" ? "number" : "text"}
        value={stringAnswer(answer)}
        onChange={(e) => onChange(e.target.value)}
        style={input}
      />
      {question.help_text ? <span style={{ color: brand.quiet, fontSize: 13 }}>{question.help_text}</span> : null}
    </label>
  );
}

export function PreAuthEligibility({
  initialPatientData = null,
  isAuthenticated = false,
  startAtMedication = false,
}: {
  initialPatientData?: IntakeDraftData | null;
  isAuthenticated?: boolean;
  startAtMedication?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startsInSignIn = Boolean(searchParams.get("signin"));
  const requestedNewMedication = Boolean(searchParams.get("new_medication"));
  const startsAtMedicationSelection = isAuthenticated && startAtMedication;
  const [step, setStep] = useState<
    "eligibility" | "treatment" | "treatment_questions" | "account"
  >(startsInSignIn ? "account" : startsAtMedicationSelection ? "treatment" : "eligibility");
  const [accountMode, setAccountMode] = useState<"signup" | "signin">(startsInSignIn ? "signin" : "signup");
  const questions = mergePreSignupQuestions([]);
  const [answers, setAnswers] = useState<IntakeQuestionAnswers>(() =>
    answersFromPatientData(initialPatientData),
  );
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentKey | null>(null);
  const [treatmentAnswers, setTreatmentAnswers] = useState<IntakeQuestionAnswers>({});
  const [intakePageIndex, setIntakePageIndex] = useState(0);
  const [medicationPageIndex, setMedicationPageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const questionPages = groupQuestionsByPage(questions);
  const currentQuestions = questionPages[intakePageIndex] ?? questionPages[0] ?? [];
  const hasNextQuestionPage = intakePageIndex < questionPages.length - 1;
  const currentPageComplete = currentQuestions.every((question) =>
    intakeAnswerComplete(question, answers[question.question_key]),
  );
  const medicationQuestions = visibleTreatmentQuestions(selectedTreatment, treatmentAnswers);
  const currentMedicationQuestion = medicationQuestions[medicationPageIndex] ?? null;
  const hasNextMedicationQuestionPage = medicationPageIndex < medicationQuestions.length - 1;
  const currentMedicationQuestionComplete = currentMedicationQuestion
    ? intakeAnswerComplete(
        currentMedicationQuestion,
        treatmentAnswers[currentMedicationQuestion.question_key],
      )
    : false;
  const medicationFlowStepCount = selectedTreatment ? Math.max(medicationQuestions.length, 1) : 1;
  const totalFlowSteps = questionPages.length + medicationFlowStepCount + 2;
  const currentFlowStep =
    step === "eligibility"
      ? intakePageIndex + 1
      : step === "treatment"
        ? questionPages.length + 1
        : step === "treatment_questions"
          ? questionPages.length + 2 + medicationPageIndex
          : totalFlowSteps;
  const progressPercent = Math.min(
    100,
    Math.max(8, (currentFlowStep / totalFlowSteps) * 100),
  );
  const canGoBack =
    (isAuthenticated && requestedNewMedication && step === "eligibility" && intakePageIndex === 0) ||
    (step === "eligibility" && intakePageIndex > 0) ||
    step === "treatment" ||
    step === "treatment_questions" ||
    step === "account";

  function goBack() {
    setError(null);
    if (step === "account") {
      setStep(selectedTreatment ? "treatment_questions" : "treatment");
      return;
    }
    if (step === "treatment_questions") {
      if (medicationPageIndex > 0) {
        setMedicationPageIndex((current) => Math.max(0, current - 1));
        return;
      }
      setStep("treatment");
      return;
    }
    if (step === "treatment") {
      if (startsAtMedicationSelection) {
        router.push("/hub");
        return;
      }
      setStep("eligibility");
      setIntakePageIndex(Math.max(0, questionPages.length - 1));
      return;
    }
    if (step === "eligibility" && intakePageIndex === 0 && isAuthenticated && requestedNewMedication) {
      router.push("/hub");
      return;
    }
    setIntakePageIndex((current) => Math.max(0, current - 1));
  }

  function intakeForCurrentState() {
    return mergeSavedPatientData(initialPatientData, buildPreAuthIntakeData(questions, answers, {
      selectedTreatment,
      questions: medicationQuestions,
      answers: treatmentAnswers,
    }));
  }

  async function saveIntakeAndContinue() {
    const intake = intakeForCurrentState();
    if (isAuthenticated) {
      setSaving(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setAccountMode("signin");
          setStep("account");
          return;
        }
        const { error: persistError } = await persistPreAuthIntake(supabase, user.id, intake);
        if (persistError) {
          setError(persistError);
          return;
        }
        router.push("/checkout");
        router.refresh();
      } finally {
        setSaving(false);
      }
      return;
    }
    window.localStorage.setItem(
      PRE_AUTH_INTAKE_STORAGE_KEY,
      serializePreAuthIntake(intake),
    );
    setAccountMode("signup");
    setStep("account");
  }

  function restartIntake() {
    setAnswers({});
    setSelectedTreatment(null);
    setTreatmentAnswers({});
    setIntakePageIndex(0);
    setMedicationPageIndex(0);
    setError(null);
    setAccountMode("signup");
    setStep("eligibility");
  }

  function continueEligibility(nextAnswers = answers) {
    setError(null);
    const unanswered = currentQuestions.find(
      (question) => !intakeAnswerComplete(question, nextAnswers[question.question_key]),
    );
    if (unanswered) {
      setError(`Answer: ${unanswered.prompt}`);
      return;
    }
    if (hasNextQuestionPage) {
      setIntakePageIndex((current) => current + 1);
      return;
    }

    const intake = buildPreAuthIntakeData(questions, nextAnswers);

    const unansweredAnyPage = questions.find(
      (question) => !intakeAnswerComplete(question, nextAnswers[question.question_key]),
    );
    if (unansweredAnyPage) {
      setError(`Answer: ${unansweredAnyPage.prompt}`);
      return;
    }
    if (intake.for_self !== true) {
      setError("Please continue only if you are completing this intake for yourself.");
      return;
    }
    if (!intake.service_state) {
      setError("Select the state where you will receive care.");
      return;
    }
    setStep("treatment");
  }

  function updateEligibilityAnswer(question: IntakeQuestion, value: IntakeQuestionAnswer) {
    const nextAnswers = {
      ...answers,
      [question.question_key]: value,
    };
    setAnswers(nextAnswers);
    setError(null);
    if (questionCanAutoAdvance(question) && intakeAnswerComplete(question, value)) {
      window.setTimeout(() => continueEligibility(nextAnswers), 120);
    }
  }

  function continueMedicationQuestion(nextTreatmentAnswers = treatmentAnswers) {
    setError(null);
    if (!currentMedicationQuestion) {
      setError("Select a treatment.");
      setStep("treatment");
      return;
    }
    if (
      !intakeAnswerComplete(
        currentMedicationQuestion,
        nextTreatmentAnswers[currentMedicationQuestion.question_key],
      )
    ) {
      setError(`Answer: ${currentMedicationQuestion.prompt}`);
      return;
    }
    if (hasNextMedicationQuestionPage) {
      setMedicationPageIndex((current) => current + 1);
      return;
    }
    const complete = medicationQuestions.every((question) =>
      intakeAnswerComplete(question, nextTreatmentAnswers[question.question_key]),
    );
    if (!complete) {
      const unanswered = medicationQuestions.find(
        (question) => !intakeAnswerComplete(question, nextTreatmentAnswers[question.question_key]),
      );
      setError(`Answer: ${unanswered?.prompt ?? "all treatment questions"}`);
      return;
    }
    void saveIntakeAndContinue();
  }

  function updateMedicationAnswer(question: IntakeQuestion, value: IntakeQuestionAnswer) {
    const nextTreatmentAnswers = {
      ...treatmentAnswers,
      [question.question_key]: value,
    };
    setTreatmentAnswers(nextTreatmentAnswers);
    setError(null);
    if (questionCanAutoAdvance(question) && intakeAnswerComplete(question, value)) {
      window.setTimeout(() => continueMedicationQuestion(nextTreatmentAnswers), 120);
    }
  }

  if (step === "account") {
    return (
      <AuthEntry
        initialMode={accountMode}
        intakeReady
        onBack={canGoBack ? goBack : undefined}
        onStartIntake={restartIntake}
      />
    );
  }

  const heading =
    step === "treatment"
      ? "Choose medication"
      : step === "treatment_questions"
        ? `${TREATMENTS.find((treatment) => treatment.key === selectedTreatment)?.name ?? "Treatment"} intake`
        : (currentQuestions[0]?.prompt ?? "Check eligibility");

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
              <span aria-hidden="true" style={backArrowGlyph}>←</span>
            </button>
          ) : null}
          <img
            src="/brand/logo-square.svg"
            alt="GMMD"
            style={{
              display: "block",
              width: 112,
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
          {isAuthenticated && requestedNewMedication && step === "eligibility" ? (
            <p style={loggedInNote}>
              Confirm the account details your provider needs for this new medication request.
              You will choose a plan after these basics are complete.
            </p>
          ) : null}
          {startsAtMedicationSelection && step === "treatment" ? (
            <p style={loggedInNote}>
              Choose the medication path you want to request. Your saved account details stay
              attached, and after the medication intake you will confirm shipping and payment.
            </p>
          ) : null}

        {step === "eligibility" ? (
          <form
            style={{ display: "grid", gap: 0 }}
            onKeyDown={(event) => {
              if (!shouldSubmitOnEnter(event)) {
                return;
              }
              event.preventDefault();
              if (currentPageComplete) {
                continueEligibility();
              }
            }}
            onSubmit={(event) => {
              event.preventDefault();
              continueEligibility();
            }}
          >
            {currentQuestions.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                hidePrompt
                answer={answers[question.question_key]}
                onChange={(value) => updateEligibilityAnswer(question, value)}
              />
            ))}

            {error ? (
              <p role="alert" style={{ margin: 0, color: brand.error, fontSize: 14 }}>
                {error}
              </p>
            ) : null}

            <div style={flowActions}>
              <button
                type="submit"
                disabled={!currentPageComplete}
                style={{
                  ...primaryAction,
                  background: currentPageComplete ? brand.actionBg : brand.disabledBg,
                  color: currentPageComplete ? brand.actionText : brand.disabledText,
                  cursor: currentPageComplete ? "pointer" : "not-allowed",
                }}
              >
                {hasNextQuestionPage ? "Next step" : "Choose treatment"}
              </button>
            </div>
            {!isAuthenticated ? (
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
            ) : null}
          </form>
        ) : null}

        {step === "treatment" ? (
          <div style={{ display: "grid", gap: 0 }}>
            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              {PATIENT_TREATMENTS.map((treatment) => {
                const selected = selectedTreatment === treatment.key;
                return (
                  <button
                    key={treatment.key}
                    type="button"
                    onClick={() => {
                      setSelectedTreatment(treatment.key);
                      setTreatmentAnswers(defaultTreatmentAnswers(treatment.key));
                      setMedicationPageIndex(0);
                      setError(null);
                      // Auto-advance after selecting a treatment is paused. Patients
                      // should confirm with the Continue button before leaving this step.
                      // window.setTimeout(() => {
                      //   setStep("treatment_questions");
                      // }, 120);
                    }}
                    style={{
                      display: "grid",
                      gap: 5,
                      minHeight: 68,
                      padding: "13px 18px",
                      textAlign: "left",
                      borderRadius: 7,
                      border: `1px solid ${selected ? brand.accent : "rgba(23, 23, 23, 0.72)"}`,
                      background: selected ? brand.accent : brand.surface2,
                      color: selected ? "#ffffff" : brand.text,
                      cursor: "pointer",
                      boxShadow: "none",
                      alignItems: "center",
                    }}
                    aria-pressed={selected}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <strong style={{ fontSize: 15, fontWeight: 500 }}>{treatment.name}</strong>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                        One-time
                      </span>
                    </span>
                    <span style={{ color: selected ? "rgba(255, 255, 255, 0.9)" : brand.text, fontSize: 13, fontWeight: 500 }}>
                      {treatment.label}
                    </span>
                    <span style={{ color: selected ? "rgba(255, 255, 255, 0.82)" : brand.muted, fontSize: 13, lineHeight: 1.35 }}>
                      {treatment.summary}
                    </span>
                  </button>
                );
              })}
            </div>
            {error ? (
              <p role="alert" style={{ margin: 0, color: brand.error, fontSize: 14 }}>
                {error}
              </p>
            ) : null}
            <div style={flowActions}>
              <button
                type="button"
                disabled={!selectedTreatment}
                style={{
                  ...primaryAction,
                  background: selectedTreatment ? brand.actionBg : brand.disabledBg,
                  color: selectedTreatment ? brand.actionText : brand.disabledText,
                  cursor: selectedTreatment ? "pointer" : "not-allowed",
                }}
                onClick={() => {
                  if (!selectedTreatment) {
                    setError("Select a treatment.");
                    return;
                  }
                  setError(null);
                  setMedicationPageIndex(0);
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
            style={{ display: "grid", gap: 18 }}
            onKeyDown={(event) => {
              if (!shouldSubmitOnEnter(event)) {
                return;
              }
              event.preventDefault();
              if (currentMedicationQuestionComplete && !saving) {
                continueMedicationQuestion();
              }
            }}
            onSubmit={(event) => {
              event.preventDefault();
              continueMedicationQuestion();
            }}
          >
            {currentMedicationQuestion ? (
              <div key={currentMedicationQuestion.id} style={{ display: "grid", minWidth: 0, gap: 12 }}>
                <QuestionField
                  question={currentMedicationQuestion}
                  answer={treatmentAnswers[currentMedicationQuestion.question_key]}
                  onChange={(value) => updateMedicationAnswer(currentMedicationQuestion, value)}
                />
                {selectedTreatment === "glp_1" && currentMedicationQuestion.question_key === "glp_1_current_weight" ? (
                  <BmiPreview answers={treatmentAnswers} />
                ) : null}
              </div>
            ) : null}
            {error ? (
              <p role="alert" style={{ margin: 0, color: brand.error, fontSize: 14 }}>
                {error}
              </p>
            ) : null}
            <div style={flowActions}>
              <button
                type="submit"
                disabled={!currentMedicationQuestionComplete || saving}
                style={{
                  ...primaryAction,
                  background: currentMedicationQuestionComplete && !saving ? brand.actionBg : brand.disabledBg,
                  color: currentMedicationQuestionComplete && !saving ? brand.actionText : brand.disabledText,
                  cursor: currentMedicationQuestionComplete && !saving ? "pointer" : "not-allowed",
                }}
              >
                {saving
                  ? "Saving..."
                  : hasNextMedicationQuestionPage
                    ? "Next step"
                    : isAuthenticated
                      ? "Continue to checkout"
                      : "Create account"}
              </button>
            </div>
          </form>
        ) : null}
        </div>
      </section>
    </main>
  );
}
