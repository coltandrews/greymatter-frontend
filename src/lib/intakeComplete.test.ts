import { describe, expect, it } from "vitest";
import { isIntakeComplete } from "./intakeComplete";

describe("isIntakeComplete", () => {
  it("treats paused_before_scheduling as complete", () => {
    expect(isIntakeComplete("paused_before_scheduling")).toBe(true);
  });

  it("rejects incomplete, empty, and unknown draft steps", () => {
    expect(isIntakeComplete("eligibility")).toBe(false);
    expect(isIntakeComplete("service_state")).toBe(false);
    expect(isIntakeComplete(null)).toBe(false);
    expect(isIntakeComplete(undefined)).toBe(false);
  });
});
