/**
 * Calls Greymatter backend routes that proxy the Ola Portal API.
 * Pass the Supabase session access_token as Bearer (see README).
 */

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return base;
}

export async function fetchVendorOlaValidateToken(supabaseAccessToken: string) {
  return fetch(`${apiBase()}/api/vendor/ola/validate-token`, {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
    },
  });
}

export async function fetchVendorOlaSchedules(
  supabaseAccessToken: string,
  state: string,
) {
  const path = `${apiBase()}/api/vendor/ola/schedules/${encodeURIComponent(state)}`;
  return fetch(path, {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
    },
  });
}
