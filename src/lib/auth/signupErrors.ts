type SignupErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
};

function asErrorRecord(value: unknown): SignupErrorLike {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SignupErrorLike)
    : {};
}

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isExistingUserSignupError(error: unknown): boolean {
  const record = asErrorRecord(error);
  const code = normalizedText(record.code);
  const message = normalizedText(record.message);
  const name = normalizedText(record.name);

  return (
    code === "user_already_exists" ||
    code === "email_exists" ||
    code === "email_already_exists" ||
    name === "useralreadyregisterederror" ||
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already exists") ||
    (message.includes("email") && message.includes("already"))
  );
}

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}
