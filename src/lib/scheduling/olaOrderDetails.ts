export type OlaOrderDetailRow = {
  label: string;
  value: string;
  mono?: boolean;
  cap?: boolean;
};

export type OlaOrderPatientSummary = {
  status: string | null;
  serviceName: string | null;
  clinicianName: string | null;
  clinicianTitle: string | null;
  clinicianAvatarUrl: string | null;
  pharmacyName: string | null;
  pharmacyPhone: string | null;
  pharmacyAddress: string | null;
  prescriptionCount: number | null;
  updatedAt: string | null;
  createdAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
  }
  return null;
}

function arrayCount(record: Record<string, unknown> | null, key: string): number | null {
  if (!record) {
    return null;
  }
  const value = record[key];
  return Array.isArray(value) ? value.length : null;
}

function formatOlaDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function providerName(provider: Record<string, unknown> | null): string | null {
  const direct = stringValue(provider, ["name", "display_name", "provider_name"]);
  if (direct) {
    return direct;
  }
  const first = stringValue(provider, ["first_name", "firstName"]);
  const last = stringValue(provider, ["last_name", "lastName"]);
  return [first, last].filter(Boolean).join(" ").trim() || null;
}

export function olaOrderPatientSummary(payload: unknown): OlaOrderPatientSummary | null {
  const root = asRecord(payload);
  const result = asRecord(root?.result) ?? root;
  if (!result) {
    return null;
  }

  const provider = asRecord(result.provider);
  const providerDetail = asRecord(asRecord(provider?.user_detail)?.data);
  const service = asRecord(result.service);

  return {
    status: stringValue(result, ["status", "order_status", "appointment_status"]),
    serviceName:
      stringValue(service, ["service_name", "name", "title"]) ??
      stringValue(result, ["service_name"]),
    clinicianName: providerName(provider),
    clinicianTitle: stringValue(providerDetail, ["title"]),
    clinicianAvatarUrl: stringValue(provider, ["user_avatar", "avatar_url", "avatarUrl"]),
    pharmacyName: stringValue(result, ["pharmacy_name", "pharmacyName"]),
    pharmacyPhone: stringValue(result, ["pharmacy_phone", "pharmacyPhone"]),
    pharmacyAddress: stringValue(result, ["pharmacy_address", "pharmacyAddress"]),
    prescriptionCount: arrayCount(result, "prescriptions"),
    updatedAt: formatOlaDate(stringValue(result, ["updated_at", "updatedAt"])),
    createdAt: formatOlaDate(stringValue(result, ["created_at", "createdAt"])),
  };
}

export function olaOrderDetailRows(payload: unknown): OlaOrderDetailRow[] {
  const root = asRecord(payload);
  const result = asRecord(root?.result) ?? root;
  if (!result) {
    return [];
  }

  const provider = asRecord(result.provider);
  const providerDetail = asRecord(asRecord(provider?.user_detail)?.data);
  const service = asRecord(result.service);
  const scheduled = asRecord(result.scheduled);

  const rows: OlaOrderDetailRow[] = [];
  const add = (
    label: string,
    value: string | null | undefined,
    options: Pick<OlaOrderDetailRow, "mono" | "cap"> = {},
  ) => {
    if (value) {
      rows.push({ label, value, ...options });
    }
  };

  add("Ola status", stringValue(result, ["status", "order_status", "appointment_status"]), {
    cap: true,
  });
  add(
    "Service",
    stringValue(service, ["service_name", "name", "title"]) ??
      stringValue(result, ["service_name"]),
  );
  add("Service type", stringValue(result, ["service_type", "type"]), { cap: true });
  add(
    "Scheduled",
    formatOlaDate(
      stringValue(scheduled, [
        "schedule_start_date",
        "scheduleStartDate",
        "start_date",
        "startDate",
        "starts_at",
        "start_time",
        "appointment_date",
        "date",
      ]),
    ),
  );
  add("Clinician", providerName(provider));
  add("Clinician title", stringValue(providerDetail, ["title"]));
  add("Pharmacy", stringValue(result, ["pharmacy_name", "pharmacyName"]));
  add("Pharmacy phone", stringValue(result, ["pharmacy_phone", "pharmacyPhone"]));
  add("Pharmacy address", stringValue(result, ["pharmacy_address", "pharmacyAddress"]));
  add("Cancellation reason", stringValue(result, ["cancellation_reason", "cancellationReason"]));

  const prescriptionCount = arrayCount(result, "prescriptions");
  if (prescriptionCount != null) {
    add("Prescriptions", String(prescriptionCount));
  }
  const consultNoteCount = arrayCount(result, "consult_notes");
  if (consultNoteCount != null) {
    add("Clinical notes", String(consultNoteCount));
  }

  add("Ola order", stringValue(result, ["order_guid", "orderGuid"]), { mono: true });
  add("Ola updated", formatOlaDate(stringValue(result, ["updated_at", "updatedAt"])));

  return rows;
}

export function olaResponseMessage(payload: unknown): string | null {
  return stringValue(asRecord(payload), ["message", "error"]);
}
