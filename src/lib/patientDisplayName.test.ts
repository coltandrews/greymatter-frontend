import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { patientWelcomeName } from "./patientDisplayName";

function user(overrides: Partial<User>): User {
  return {
    id: "user-1",
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    user_metadata: {},
    ...overrides,
  } as User;
}

describe("patientWelcomeName", () => {
  it("prefers preferred name from intake draft", () => {
    expect(
      patientWelcomeName(user({ email: "casey@example.com" }), {
        preferred_name: " sam ",
        legal_first_name: "Casey",
      }),
    ).toBe("Sam");
  });

  it("falls back to legal first name, metadata, then email local part", () => {
    expect(
      patientWelcomeName(user({ email: "casey@example.com" }), {
        legal_first_name: " casey ",
      }),
    ).toBe("Casey");

    expect(
      patientWelcomeName(user({
        email: "patient@example.com",
        user_metadata: { full_name: "taylor grey" },
      })),
    ).toBe("Taylor");

    expect(patientWelcomeName(user({ email: "jane.doe@example.com" }))).toBe("Jane");
  });

  it("uses a neutral fallback when no patient label is available", () => {
    expect(patientWelcomeName(user({ email: undefined }))).toBe("there");
  });
});
