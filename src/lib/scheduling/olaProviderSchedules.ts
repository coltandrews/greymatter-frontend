/**
 * Ola Portal "get provider schedules" response shape
 * (`GET .../telehealth/schedules/get-provider-schedules/{state}/service/{service_id}`).
 * @see greymatter-backend/docs/ola-portal-openapi.json
 *
 * We use fixtures with this shape until `NEXT_PUBLIC_OLA_SCHEDULES_LIVE=true` wires the backend proxy.
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

/** Demo provider (stable GUIDs help future Ola booking payloads). */
const FIXTURE_PROVIDER_GUID = "7efa59e3-fc64-42eb-8a3f-daa07026ac7c";

const FIXTURE_PROVIDER: OlaProviderDetails = {
  first_name: "Alex",
  last_name: "Morgan",
};

function addMinutesIso(isoStart: string, minutes: number): string {
  const t = new Date(isoStart).getTime();
  return new Date(t + minutes * 60 * 1000).toISOString();
}

/**
 * Build a valid Ola-style JSON body with sample slots for `dateIso` (YYYY-MM-DD).
 */
export function buildFixtureOlaProviderSchedules(dateIso: string): OlaProviderSchedulesResponse {
  const base = `${dateIso}T17:00:00.000Z`;
  const rows: OlaProviderScheduleSlot[] = [];
  for (let i = 0; i < 8; i++) {
    const start_datetime = addMinutesIso(base, i * 15);
    const end_datetime = addMinutesIso(start_datetime, 15);
    rows.push({
      schedule_date: dateIso,
      start_datetime,
      end_datetime,
      provider_guid: FIXTURE_PROVIDER_GUID,
      appt_length: 15,
      provider_details: { ...FIXTURE_PROVIDER },
    });
  }
  return {
    success: true,
    message: "Schedules Retrieved Successfully",
    data: rows,
  };
}

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

export function olaSchedulesLiveEnabled(): boolean {
  return process.env.NEXT_PUBLIC_OLA_SCHEDULES_LIVE === "true";
}
