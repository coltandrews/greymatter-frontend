import { describe, expect, it } from "vitest";
import {
  configHealthStatusView,
  configHealthSummary,
  sortConfigHealthChecks,
} from "./configHealth";

describe("config health dashboard helpers", () => {
  it("summarizes the most important deployment state", () => {
    expect(configHealthSummary(null)).toBe("Not checked yet.");
    expect(configHealthSummary({
      status: "ok",
      checkedAt: "2026-05-01T12:00:00.000Z",
      checks: [
        { key: "supabase", label: "Supabase", status: "ok", message: "Ready" },
      ],
    })).toBe("All deployment checks are passing.");
    expect(configHealthSummary({
      status: "degraded",
      checkedAt: "2026-05-01T12:00:00.000Z",
      checks: [
        { key: "stripe", label: "Stripe", status: "error", message: "Missing key" },
        { key: "ola", label: "Ola", status: "warning", message: "Skipped" },
      ],
    })).toBe("1 issue needs attention.");
  });

  it("sorts errors and warnings before healthy checks", () => {
    expect(sortConfigHealthChecks([
      { key: "ok", label: "OK", status: "ok", message: "Ready" },
      { key: "error", label: "Error", status: "error", message: "Missing" },
      { key: "warning", label: "Warning", status: "warning", message: "Review" },
    ]).map((check) => check.key)).toEqual(["error", "warning", "ok"]);
  });

  it("maps status to staff-facing labels", () => {
    expect(configHealthStatusView("error").label).toBe("Needs attention");
    expect(configHealthStatusView("warning").label).toBe("Warning");
    expect(configHealthStatusView("ok").label).toBe("OK");
  });
});
