export type IntakeQuestionType =
  | "text"
  | "textarea"
  | "select"
  | "multi_select"
  | "yes_no"
  | "date"
  | "number";

export type IntakeQuestionOption = {
  value: string;
  label: string;
};

export type IntakeQuestion = {
  id: string;
  question_key: string;
  prompt: string;
  help_text: string | null;
  question_type: IntakeQuestionType;
  required: boolean;
  options: IntakeQuestionOption[];
  position: number;
  is_active: boolean;
};

export type IntakeQuestionAnswer = string | string[];
export type IntakeQuestionAnswers = Record<string, IntakeQuestionAnswer>;

const optionTypes: IntakeQuestionType[] = ["select", "multi_select"];
const corePreSignupKeys = [
  "legal_first_name",
  "legal_last_name",
  "date_of_birth",
  "gender",
  "service_state",
  "for_self",
] as const;

export type CorePreSignupQuestionKey = (typeof corePreSignupKeys)[number];

export const defaultPreSignupQuestions: IntakeQuestion[] = [
  {
    id: "default-legal-first-name",
    question_key: "legal_first_name",
    prompt: "First Name",
    help_text: null,
    question_type: "text",
    required: true,
    options: [],
    position: 10,
    is_active: true,
  },
  {
    id: "default-legal-last-name",
    question_key: "legal_last_name",
    prompt: "Last Name",
    help_text: null,
    question_type: "text",
    required: true,
    options: [],
    position: 20,
    is_active: true,
  },
  {
    id: "default-date-of-birth",
    question_key: "date_of_birth",
    prompt: "Date Of Birth",
    help_text: null,
    question_type: "date",
    required: true,
    options: [],
    position: 30,
    is_active: true,
  },
  {
    id: "default-gender",
    question_key: "gender",
    prompt: "Gender",
    help_text: null,
    question_type: "select",
    required: true,
    options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "non_binary", label: "Non-Binary" },
      { value: "prefer_not", label: "Prefer Not To Say" },
    ],
    position: 40,
    is_active: true,
  },
  {
    id: "default-service-state",
    question_key: "service_state",
    prompt: "State",
    help_text: "State where the patient will receive care.",
    question_type: "select",
    required: true,
    options: [],
    position: 50,
    is_active: true,
  },
  {
    id: "default-for-self",
    question_key: "for_self",
    prompt: "Are You Booking Care For Yourself?",
    help_text: null,
    question_type: "yes_no",
    required: true,
    options: [],
    position: 60,
    is_active: true,
  },
];

export function questionTypeNeedsOptions(type: IntakeQuestionType): boolean {
  return optionTypes.includes(type);
}

export function isCorePreSignupQuestionKey(
  key: string,
): key is CorePreSignupQuestionKey {
  return corePreSignupKeys.includes(key as CorePreSignupQuestionKey);
}

export function mergePreSignupQuestions(
  rows: IntakeQuestion[],
  options: { includeInactive?: boolean } = {},
): IntakeQuestion[] {
  const byKey = new Map(rows.map((row) => [row.question_key, row]));
  const core = defaultPreSignupQuestions
    .map((question) => byKey.get(question.question_key) ?? question)
    .filter((question) => options.includeInactive || question.is_active);
  const custom = rows.filter(
    (row) =>
      !isCorePreSignupQuestionKey(row.question_key) &&
      (options.includeInactive || row.is_active),
  );
  return [...core, ...custom].sort((a, b) => a.position - b.position);
}

export function makeQuestionKey(prompt: string): string {
  return prompt
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function parseOptionsText(value: string): IntakeQuestionOption[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawValue, ...labelParts] = line.split("|");
      const optionValue = rawValue.trim();
      const label = labelParts.join("|").trim() || optionValue;
      return {
        value: makeQuestionKey(optionValue) || optionValue,
        label,
      };
    });
}

export function optionsToText(options: IntakeQuestionOption[]): string {
  return options.map((option) => `${option.value}|${option.label}`).join("\n");
}

export function intakeAnswerComplete(
  question: Pick<IntakeQuestion, "question_type" | "required">,
  answer: IntakeQuestionAnswer | undefined,
): boolean {
  if (!question.required) {
    return true;
  }
  if (question.question_type === "multi_select") {
    return Array.isArray(answer) && answer.length > 0;
  }
  return typeof answer === "string" && answer.trim().length > 0;
}

export function normalizeIntakeAnswers(
  questions: Pick<IntakeQuestion, "question_key" | "question_type">[],
  answers: IntakeQuestionAnswers,
): IntakeQuestionAnswers {
  return questions.reduce<IntakeQuestionAnswers>((acc, question) => {
    const answer = answers[question.question_key];
    if (question.question_type === "multi_select") {
      if (Array.isArray(answer) && answer.length > 0) {
        acc[question.question_key] = answer.filter(Boolean);
      }
      return acc;
    }
    if (typeof answer === "string" && answer.trim()) {
      acc[question.question_key] = answer.trim();
    }
    return acc;
  }, {});
}
