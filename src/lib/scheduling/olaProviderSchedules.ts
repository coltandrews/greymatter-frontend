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

export type SlotDisplay = { start: string; label: string; provider?: string };

/**
 * Parse Ola schedule JSON into UI slot rows for a single calendar day.
 */
export function slotsFromOlaScheduleResponse(
  json: unknown,
  dateIso: string,
): SlotDisplay[] {
  if (!json || typeof json !== "object") {
    return [];
  }
  const o = json as Record<string, unknown>;
  const data = o.data;
  if (!Array.isArray(data)) {
    return [];
  }
  const dayPrefix = dateIso.slice(0, 10);
  const out: SlotDisplay[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const r = row as Record<string, unknown>;
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
    out.push({
      start,
      label: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      provider,
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
