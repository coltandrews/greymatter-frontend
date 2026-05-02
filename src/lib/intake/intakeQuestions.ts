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

export function questionTypeNeedsOptions(type: IntakeQuestionType): boolean {
  return optionTypes.includes(type);
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
