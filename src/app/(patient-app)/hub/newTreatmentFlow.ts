import type { IntakeDraftData } from "@/lib/intake/draftData";

export const ID_BUCKET = "patient-documents";
export const EMPTY_ID_UPLOADS: IdUploads = { front: null, back: null };
export const EMPTY_SAVED_ID_DOCUMENTS: SavedIdDocuments = { front: null, back: null };

const ID_MAX_BYTES = 10 * 1024 * 1024;
const ID_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

export type NewTreatmentStep = "select" | "questions" | "shipping" | "checkout" | "payment";
export type ShippingForm = {
  street_address: string;
  address_line2: string;
  city: string;
  address_state: string;
  zip: string;
};
export type IdSide = "front" | "back";
export type IdUploads = Record<IdSide, File | null>;
export type SavedIdDocument = {
  kind: "government_id_front" | "government_id_back";
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};
export type SavedIdDocuments = Record<IdSide, SavedIdDocument | null>;

export function shippingFromIntake(data: IntakeDraftData | null): ShippingForm {
  return {
    street_address: data?.street_address?.trim() ?? "",
    address_line2: data?.address_line2?.trim() ?? "",
    city: data?.city?.trim() ?? "",
    address_state: data?.address_state?.trim() || data?.service_state?.trim() || "",
    zip: data?.zip?.trim() ?? "",
  };
}

export function shippingPatch(form: ShippingForm): IntakeDraftData {
  const state = form.address_state.trim();
  return {
    street_address: form.street_address.trim(),
    address_line2: form.address_line2.trim(),
    city: form.city.trim(),
    address_state: state,
    service_state: state,
    zip: form.zip.trim(),
    country: "US",
  };
}

export function shippingComplete(form: ShippingForm): boolean {
  return Boolean(
    form.street_address.trim() &&
      form.city.trim() &&
      form.address_state.trim() &&
      form.zip.trim(),
  );
}

export function shippingSummary(form: ShippingForm): string {
  return [
    form.street_address.trim(),
    form.address_line2.trim(),
    [form.city.trim(), form.address_state.trim(), form.zip.trim()].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" ");
}

export function validateIdFile(file: File | null): string | null {
  if (!file) {
    return null;
  }
  if (!ID_MIME_TYPES.has(file.type)) {
    return "Use a JPG, PNG, or PDF for your ID.";
  }
  if (file.size <= 0 || file.size > ID_MAX_BYTES) {
    return "ID files must be 10 MB or less.";
  }
  return null;
}

export function idExtension(mimeType: string): string {
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  return "jpg";
}

function savedDocumentForSide(document: SavedIdDocument | null): boolean {
  return Boolean(document?.storage_path && document.mime_type && document.size_bytes > 0);
}

export function savedIdDocumentsComplete(documents: SavedIdDocuments): boolean {
  return savedDocumentForSide(documents.front) && savedDocumentForSide(documents.back);
}
