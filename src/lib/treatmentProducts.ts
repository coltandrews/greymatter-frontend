import type { TreatmentKey, TreatmentOption } from "@/lib/treatments";
import { PATIENT_TREATMENTS, treatmentByKey } from "@/lib/treatments";

export type TreatmentProduct = {
  id: string | null;
  product_key: TreatmentKey;
  name: string;
  label: string;
  summary: string;
  description: string;
  service_key: string;
  service_type: "initial";
  billing_type: "subscription" | "one_time";
  price_id: string;
  consultation_fee_cents: number;
  medication_fee_cents: number;
  currency: string;
  question_set_key: TreatmentKey;
  sort_order: number;
};

function fromTreatmentOption(treatment: TreatmentOption): TreatmentProduct {
  return {
    id: null,
    product_key: treatment.key,
    name: treatment.name,
    label: treatment.label,
    summary: treatment.summary,
    description: treatment.summary,
    service_key: treatment.serviceKey,
    service_type: "initial",
    billing_type: "one_time",
    price_id: "",
    consultation_fee_cents: treatment.consultationFeeCents,
    medication_fee_cents: treatment.medicationFeeCents,
    currency: "usd",
    question_set_key: treatment.key,
    sort_order: 0,
  };
}

export const FALLBACK_TREATMENT_PRODUCTS = PATIENT_TREATMENTS.map(fromTreatmentOption);

function isTreatmentKey(value: string): value is TreatmentKey {
  return value === "glp_1" || value === "peptides" || value === "testosterone";
}

function stringValue(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function numberValue(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function treatmentProductFromRow(row: unknown): TreatmentProduct | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }
  const record = row as Record<string, unknown>;
  const productKey = stringValue(record, "product_key");
  const questionSetKey = stringValue(record, "question_set_key") || productKey;
  if (!isTreatmentKey(productKey) || !isTreatmentKey(questionSetKey)) {
    return null;
  }
  const fallback = treatmentByKey(productKey);
  const rowName = stringValue(record, "name").replace(/\s+subscription$/i, "");
  const useFallbackCopy = productKey === "glp_1";

  return {
    id: stringValue(record, "id") || null,
    product_key: productKey,
    name: rowName || fallback?.name || productKey,
    label: useFallbackCopy
      ? fallback?.label ?? stringValue(record, "label")
      : stringValue(record, "label"),
    summary: useFallbackCopy
      ? fallback?.summary ?? stringValue(record, "summary")
      : stringValue(record, "summary"),
    description: useFallbackCopy
      ? fallback?.summary ?? stringValue(record, "description")
      : stringValue(record, "description"),
    service_key: stringValue(record, "service_key"),
    service_type: "initial",
    billing_type: "one_time",
    price_id: stringValue(record, "price_id"),
    consultation_fee_cents: numberValue(record, "consultation_fee_cents"),
    medication_fee_cents: numberValue(record, "medication_fee_cents"),
    currency: stringValue(record, "currency") || "usd",
    question_set_key: questionSetKey,
    sort_order: numberValue(record, "sort_order"),
  };
}
