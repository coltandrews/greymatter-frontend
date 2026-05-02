import { describe, expect, it } from "vitest";
import {
  intakeAnswerComplete,
  isCorePreSignupQuestionKey,
  makeQuestionKey,
  mergePreSignupQuestions,
  normalizeIntakeAnswers,
  optionsToText,
  parseOptionsText,
} from "./intakeQuestions";

describe("intake question helpers", () => {
  it("creates stable question keys", () => {
    expect(makeQuestionKey("Do you take GLP-1 medication?")).toBe(
      "do_you_take_glp_1_medication",
    );
  });

  it("parses formatted option labels into stored values and labels", () => {
    expect(parseOptionsText("Yes\nNo\nPrefer Not To Say")).toEqual([
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "prefer_not_to_say", label: "Prefer Not To Say" },
    ]);
  });

  it("keeps option editing focused on display labels", () => {
    expect(optionsToText([
      { value: "yes", label: "Yes" },
      { value: "prefer_not_to_say", label: "Prefer Not To Say" },
    ])).toBe("Yes\nPrefer Not To Say");
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

  it("merges configured core questions with default pre-signup questions", () => {
    const merged = mergePreSignupQuestions([
      {
        id: "db-first",
        question_key: "legal_first_name",
        prompt: "Legal First Name",
        help_text: null,
        question_type: "text",
        required: true,
        options: [],
        position: 10,
        is_active: true,
      },
    ]);

    expect(merged[0]).toMatchObject({
      id: "db-first",
      prompt: "Legal First Name",
    });
    expect(merged.map((question) => question.question_key)).toContain("for_self");
    expect(isCorePreSignupQuestionKey("service_state")).toBe(true);
  });
});
