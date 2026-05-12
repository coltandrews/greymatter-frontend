import { describe, expect, it } from "vitest";
import {
  TREATMENTS,
  treatmentByKey,
  treatmentQuestions,
  treatmentQuestionSet,
} from "./treatments";

describe("treatment registry", () => {
  it("keeps every treatment wired to an active question set", () => {
    for (const treatment of TREATMENTS) {
      const set = treatmentQuestionSet(treatment.key);
      expect(set).toMatchObject({
        treatmentKey: treatment.key,
        source: expect.any(String),
        version: expect.any(String),
      });
      expect(treatmentQuestions(treatment.key).length).toBeGreaterThan(0);
    }
  });

  it("returns null or empty values for unknown selections", () => {
    expect(treatmentByKey("unknown")).toBeNull();
    expect(treatmentQuestionSet(null)).toBeNull();
    expect(treatmentQuestions(null)).toEqual([]);
  });
});
