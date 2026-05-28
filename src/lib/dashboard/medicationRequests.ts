import { treatmentByKey } from "@/lib/treatments";

type UnknownRecord = Record<string, unknown>;

export type MedicationRequestStatusKey =
  | "draft"
  | "payment_pending"
  | "payment_failed"
  | "provider_handoff"
  | "under_review"
  | "needs_attention"
  | "next_steps"
  | "confirmed"
  | "cancelled";

export type MedicationRequestTone =
  | "confirmed"
  | "pending"
  | "action"
  | "review"
  | "cancelled"
  | "failed"
  | "neutral";

export type MedicationRequestStatusInput = {
  bookingStatus: string | null;
  paymentStatus: string | null;
  olaStatus: string | null;
  failureReason?: string | null;
  hasNextSteps?: boolean | null;
};

export type MedicationRequestStatusView = {
  key: MedicationRequestStatusKey;
  label: string;
  description: string;
  tone: MedicationRequestTone;
  submitted: boolean;
  terminal: boolean;
  sortRank: number;
};

export type MedicationRequestDocument = {
  kind?: string | null;
  sentToOlaAt?: string | null;
  sent_to_ola_at?: string | null;
};

export type MedicationRequestIdStatus = {
  frontUploaded: boolean;
  backUploaded: boolean;
  complete: boolean;
  sentToOla: boolean;
  label: string;
};

export type MedicationRequestAttentionReason =
  | "payment_failed"
  | "provider_handoff_failed"
  | "missing_id"
  | "missing_shipping";

export type MedicationRequestAttention = {
  needsAttention: boolean;
  reasons: MedicationRequestAttentionReason[];
};

export type MedicationRequestLifecycleCounts = {
  paymentPending: number;
  providerHandoff: number;
  underReview: number;
  needsAttention: number;
  nextSteps: number;
  confirmed: number;
  cancelled: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const medicationRequestToneStyles: Record<
  MedicationRequestTone,
  { color: string; background: string }
> = {
  confirmed: { color: "#166534", background: "rgba(22, 163, 74, 0.16)" },
  pending: { color: "#2563eb", background: "rgba(52, 135, 237, 0.16)" },
  action: { color: "#92400e", background: "rgba(180, 83, 9, 0.16)" },
  review: { color: "#92400e", background: "rgba(180, 83, 9, 0.16)" },
  cancelled: { color: "var(--gm-muted)", background: "var(--gm-border)" },
  failed: { color: "var(--gm-error)", background: "rgba(127, 29, 29, 0.24)" },
  neutral: { color: "var(--gm-muted)", background: "var(--gm-border)" },
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringValue(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function documentKind(document: MedicationRequestDocument): string {
  return String(document.kind ?? "").trim();
}

function documentSentToOla(document: MedicationRequestDocument): boolean {
  return hasText(document.sentToOlaAt) || hasText(document.sent_to_ola_at);
}

export function medicationRequestStatusView(
  input: MedicationRequestStatusInput,
): MedicationRequestStatusView {
  const bookingStatus = input.bookingStatus;
  const paymentStatus = input.paymentStatus;
  const olaStatus = input.olaStatus;
  const failureReason = input.failureReason?.trim();

  if (bookingStatus === "cancelled") {
    return {
      key: "cancelled",
      label: "Cancelled",
      description: "This medication request was cancelled.",
      tone: "cancelled",
      submitted: false,
      terminal: true,
      sortRank: 80,
    };
  }

  if (paymentStatus === "failed") {
    return {
      key: "payment_failed",
      label: "Payment failed",
      description: "Payment did not complete. The request has not been submitted.",
      tone: "failed",
      submitted: false,
      terminal: false,
      sortRank: 10,
    };
  }

  if (
    paymentStatus !== "paid" ||
    bookingStatus === "draft" ||
    bookingStatus === "payment_pending"
  ) {
    return {
      key: bookingStatus === "draft" ? "draft" : "payment_pending",
      label: bookingStatus === "draft" ? "Draft" : "Payment pending",
      description: "Checkout is not complete. This medication request is not submitted yet.",
      tone: "pending",
      submitted: false,
      terminal: false,
      sortRank: 20,
    };
  }

  if (bookingStatus === "action_required" || input.hasNextSteps) {
    return {
      key: "next_steps",
      label: "Next steps",
      description: "Provider next steps are ready for the patient.",
      tone: "action",
      submitted: true,
      terminal: false,
      sortRank: 30,
    };
  }

  if (bookingStatus === "booked" && olaStatus === "booked") {
    return {
      key: "confirmed",
      label: "Confirmed",
      description: "Payment and provider network submission are complete.",
      tone: "confirmed",
      submitted: true,
      terminal: true,
      sortRank: 70,
    };
  }

  if (bookingStatus === "needs_review") {
    return {
      key: "under_review",
      label: "Provider review",
      description: "Payment received. Waiting for the provider network response.",
      tone: "review",
      submitted: true,
      terminal: false,
      sortRank: 40,
    };
  }

  if (olaStatus === "failed" || hasText(failureReason)) {
    return {
      key: "needs_attention",
      label: "Exception",
      description: "Provider network submission failed or needs staff follow-up.",
      tone: "failed",
      submitted: true,
      terminal: false,
      sortRank: 0,
    };
  }

  return {
    key: "provider_handoff",
    label: "Sending to provider",
    description: "Payment received. The request is being sent to the provider network.",
    tone: "pending",
    submitted: true,
    terminal: false,
    sortRank: 50,
  };
}

export function medicationRequestTreatmentKey(intakeData: unknown): string | null {
  return stringValue(asRecord(intakeData), "selected_treatment");
}

export function medicationRequestTreatmentLabel(intakeData: unknown): string {
  const key = medicationRequestTreatmentKey(intakeData);
  const treatment = treatmentByKey(key);
  return treatment?.name ?? key ?? "Treatment not selected";
}

export function medicationRequestTreatmentAnswerCount(intakeData: unknown): number {
  const answers = asRecord(intakeData).treatment_answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return 0;
  }
  return Object.values(answers).filter((value) => {
    if (Array.isArray(value)) {
      return value.some((item) => String(item).trim());
    }
    return String(value ?? "").trim().length > 0;
  }).length;
}

export function medicationRequestPatientName(intakeData: unknown): string {
  const intake = asRecord(intakeData);
  const first = stringValue(intake, "legal_first_name");
  const last = stringValue(intake, "legal_last_name");
  return [first, last].filter(Boolean).join(" ") || "Patient";
}

export function medicationRequestPhoneLast4(intakeData: unknown): string | null {
  const phone = stringValue(asRecord(intakeData), "phone");
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export function medicationRequestShippingSummary(intakeData: unknown): string {
  const intake = asRecord(intakeData);
  const line1 = stringValue(intake, "street_address");
  const line2 = stringValue(intake, "address_line2");
  const city = stringValue(intake, "city");
  const state = stringValue(intake, "address_state") ?? stringValue(intake, "service_state");
  const zip = stringValue(intake, "zip");
  const cityState = [city, state].filter(Boolean).join(", ");
  return [line1, line2, [cityState, zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ") || "Shipping address missing";
}

export function medicationRequestIdStatus(
  documents: MedicationRequestDocument[] | null | undefined,
): MedicationRequestIdStatus {
  const docs = documents ?? [];
  const front = docs.find((document) => documentKind(document) === "government_id_front");
  const back = docs.find((document) => documentKind(document) === "government_id_back");
  const legacy = docs.find((document) => documentKind(document) === "government_id");
  const frontUploaded = Boolean(front || legacy);
  const backUploaded = Boolean(back || legacy);
  const complete = frontUploaded && backUploaded;
  const sentToOla = legacy
    ? documentSentToOla(legacy)
    : Boolean(front && back && documentSentToOla(front) && documentSentToOla(back));

  return {
    frontUploaded,
    backUploaded,
    complete,
    sentToOla,
    label: complete ? (sentToOla ? "ID sent to provider" : "ID uploaded") : "ID missing",
  };
}

export function medicationRequestAgeLabel(
  value: string | null | undefined,
  now = new Date(),
): string {
  if (!value) {
    return "Not recorded";
  }
  const date = new Date(value);
  const diffMs = now.getTime() - date.getTime();
  if (!Number.isFinite(diffMs) || Number.isNaN(date.getTime())) {
    return value;
  }
  if (diffMs < 0) {
    return "Just now";
  }
  if (diffMs < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));
    return `${minutes}m ago`;
  }
  if (diffMs < ONE_DAY_MS) {
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    return `${hours}h ago`;
  }
  const days = Math.floor(diffMs / ONE_DAY_MS);
  return `${days}d ago`;
}

export function medicationRequestNeedsAttention(input: {
  status: MedicationRequestStatusView;
  intakeData?: unknown;
  idStatus?: MedicationRequestIdStatus | null;
  updatedAt?: string | null;
  now?: Date;
}): MedicationRequestAttention {
  const reasons: MedicationRequestAttentionReason[] = [];
  const intake = asRecord(input.intakeData);

  if (input.status.key === "payment_failed") {
    reasons.push("payment_failed");
  }
  if (input.status.key === "needs_attention") {
    reasons.push("provider_handoff_failed");
  }
  if (input.status.submitted && input.idStatus && !input.idStatus.complete) {
    reasons.push("missing_id");
  }
  if (
    input.status.submitted &&
    (!stringValue(intake, "street_address") ||
      !stringValue(intake, "city") ||
      !stringValue(intake, "zip"))
  ) {
    reasons.push("missing_shipping");
  }
  return {
    needsAttention: reasons.length > 0,
    reasons: Array.from(new Set(reasons)),
  };
}

export function medicationRequestLifecycleCounts(
  rows: MedicationRequestStatusInput[],
): MedicationRequestLifecycleCounts {
  return rows.reduce<MedicationRequestLifecycleCounts>(
    (counts, row) => {
      const status = medicationRequestStatusView(row);
      switch (status.key) {
        case "payment_pending":
        case "draft":
        case "payment_failed":
          counts.paymentPending += 1;
          break;
        case "provider_handoff":
          counts.providerHandoff += 1;
          break;
        case "under_review":
          counts.underReview += 1;
          break;
        case "needs_attention":
          counts.needsAttention += 1;
          break;
        case "next_steps":
          counts.nextSteps += 1;
          break;
        case "confirmed":
          counts.confirmed += 1;
          break;
        case "cancelled":
          counts.cancelled += 1;
          break;
      }
      return counts;
    },
    {
      paymentPending: 0,
      providerHandoff: 0,
      underReview: 0,
      needsAttention: 0,
      nextSteps: 0,
      confirmed: 0,
      cancelled: 0,
    },
  );
}
