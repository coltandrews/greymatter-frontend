import { describe, expect, it } from "vitest";
import {
  intakeAnswerComplete,
  makeQuestionKey,
  normalizeIntakeAnswers,
  parseOptionsText,
} from "./intakeQuestions";

describe("intake question helpers", () => {
  it("creates stable question keys", () => {
    expect(makeQuestionKey("Do you take GLP-1 medication?")).toBe(
      "do_you_take_glp_1_medication",
    );
  });

  it("parses option text into values and labels", () => {
    expect(parseOptionsText("yes|Yes\nno|No\nMaybe")).toEqual([
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "maybe", label: "Maybe" },
    ]);
  });

  it("requires multi-select answers when configured", () => {
    expect(
      intakeAnswerComplete(
        { question_type: "multi_select", required: true },
        [],
      ),
    ).toBe(false);
    expect(
      intakeAnswerComplete(
        { question_type: "multi_select", required: true },
        ["a"],
      ),
    ).toBe(true);
  });

  it("normalizes answer payloads", () => {
    expect(
      normalizeIntakeAnswers(
        [
          { question_key: "symptoms", question_type: "multi_select" },
          { question_key: "notes", question_type: "textarea" },
        ],
        {
          symptoms: ["nausea", ""],
          notes: "  Some detail  ",
          ignored: "x",
        },
      ),
    ).toEqual({
      symptoms: ["nausea"],
      notes: "Some detail",
    });
  });
});
