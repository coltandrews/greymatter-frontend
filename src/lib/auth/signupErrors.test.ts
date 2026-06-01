import { describe, expect, it } from "vitest";
import { isExistingUserSignupError, normalizeAuthEmail } from "./signupErrors";

describe("isExistingUserSignupError", () => {
  it("detects Supabase duplicate-account code responses", () => {
    expect(
      isExistingUserSignupError({
        code: "user_already_exists",
        message: "User already registered",
      }),
    ).toBe(true);
  });

  it("detects duplicate-account messages without a code", () => {
    expect(isExistingUserSignupError({ message: "Email has already been registered" })).toBe(
      true,
    );
  });

  it("does not classify unrelated auth errors as existing accounts", () => {
    expect(isExistingUserSignupError({ code: "weak_password", message: "Password is weak" })).toBe(
      false,
    );
  });
});

describe("normalizeAuthEmail", () => {
  it("trims and lowercases emails before auth submission", () => {
    expect(normalizeAuthEmail("  Patient@Example.COM ")).toBe("patient@example.com");
  });
});
