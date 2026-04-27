/**
 * Ola Portal "get provider schedules" response shape
 * (`GET .../telehealth/schedules/get-provider-schedules/{state}/service/{service_id}`).
 * @see greymatter-backend/docs/ola-portal-openapi.json
 */

export type OlaProviderDetails = {
  first_name: string;
  last_name: string;
  user_avatar?: string;
};

/** One open slot row from Ola `data[]`. */
export type OlaProviderScheduleSlot = {
  schedule_date: string;
  start_datetime: string;
  end_datetime: string;
  provider_guid: string;
  appt_length: number;
  provider_details: OlaProviderDetails;
};

export type OlaProviderSchedulesResponse = {
  success: boolean;
  message: string;
  data: OlaProviderScheduleSlot[];
};

export type SlotDisplay = {
  id: string;
  start: string;
  end: string;
  label: string;
  provider?: string;
  providerGuid?: string;
};

function scheduleRows(json: unknown): Record<string, unknown>[] {
  if (!json || typeof json !== "object") {
    return [];
  }
  const data = (json as Record<string, unknown>).data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row && typeof row === "object"),
  );
}

export function availableDatesFromOlaScheduleResponse(json: unknown): Set<string> {
  const dates = new Set<string>();
  for (const row of scheduleRows(json)) {
    const start = typeof row.start_datetime === "string" ? row.start_datetime : "";
    const scheduleDate =
      typeof row.schedule_date === "string" ? row.schedule_date : "";
    const date = scheduleDate.slice(0, 10) || start.slice(0, 10);
    if (date) {
      dates.add(date);
    }
  }
  return dates;
}

/**
 * Parse Ola schedule JSON into UI slot rows for a single calendar day.
 */
export function slotsFromOlaScheduleResponse(
  json: unknown,
  dateIso: string,
): SlotDisplay[] {
  const dayPrefix = dateIso.slice(0, 10);
  const out: SlotDisplay[] = [];
  for (const r of scheduleRows(json)) {
    const start = typeof r.start_datetime === "string" ? r.start_datetime : null;
    if (!start) {
      continue;
    }
    const slotDay = start.slice(0, 10);
    if (slotDay !== dayPrefix) {
      continue;
    }
    const d = new Date(start);
    const pd = r.provider_details;
    let provider: string | undefined;
    if (pd && typeof pd === "object") {
      const p = pd as Record<string, unknown>;
      const fn = typeof p.first_name === "string" ? p.first_name : "";
      const ln = typeof p.last_name === "string" ? p.last_name : "";
      const name = `${fn} ${ln}`.trim();
      provider = name || undefined;
    }
    const end = typeof r.end_datetime === "string" ? r.end_datetime : start;
    const providerGuid =
      typeof r.provider_guid === "string" ? r.provider_guid : undefined;
    out.push({
      id: [start, end, providerGuid ?? provider ?? ""].join("|"),
      start,
      end,
      label: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      provider,
      providerGuid,
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
