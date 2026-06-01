import type { IntakeQuestion, IntakeQuestionAnswer } from "@/lib/intake/intakeQuestions";
import styles from "./hub.module.css";

function stringAnswer(answer: IntakeQuestionAnswer | undefined): string {
  return typeof answer === "string" ? answer : "";
}

function arrayAnswer(answer: IntakeQuestionAnswer | undefined): string[] {
  return Array.isArray(answer) ? answer : [];
}

export function ProductQuestionField({
  answer,
  onChange,
  question,
}: {
  answer: IntakeQuestionAnswer | undefined;
  onChange: (value: IntakeQuestionAnswer) => void;
  question: IntakeQuestion;
}) {
  if (question.question_type === "textarea") {
    return (
      <label className={styles.hubField}>
        {question.prompt}
        <textarea
          value={stringAnswer(answer)}
          onChange={(event) => onChange(event.target.value)}
          className={styles.hubTextarea}
        />
      </label>
    );
  }

  if (question.question_type === "select") {
    return (
      <label className={styles.hubField}>
        {question.prompt}
        <select
          value={stringAnswer(answer)}
          onChange={(event) => onChange(event.target.value)}
          className={styles.hubInput}
        >
          <option value="">Select</option>
          {question.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (question.question_type === "multi_select") {
    const selected = arrayAnswer(answer);
    return (
      <fieldset className={styles.hubFieldset}>
        <legend>{question.prompt}</legend>
        <div className={styles.hubOptionGrid}>
          {question.options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className={`${styles.hubOption} ${checked ? styles.hubOptionSelected : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, option.value]
                        : selected.filter((value) => value !== option.value),
                    )
                  }
                />
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
      <fieldset className={styles.hubFieldset}>
        <legend>{question.prompt}</legend>
        <div className={styles.hubOptionGrid}>
          {[
            ["yes", "Yes"],
            ["no", "No"],
          ].map(([value, label]) => {
            const checked = answer === value;
            return (
              <label
                key={value}
                className={`${styles.hubOption} ${checked ? styles.hubOptionSelected : ""}`}
              >
                <input
                  type="radio"
                  name={question.question_key}
                  value={value}
                  checked={checked}
                  onChange={() => onChange(value)}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <label className={styles.hubField}>
      {question.prompt}
      <input
        type={
          question.question_type === "date"
            ? "date"
            : question.question_type === "number"
              ? "number"
              : "text"
        }
        value={stringAnswer(answer)}
        onChange={(event) => onChange(event.target.value)}
        className={styles.hubInput}
      />
    </label>
  );
}
