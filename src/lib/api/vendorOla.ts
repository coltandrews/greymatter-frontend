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

export async function updateVendorOlaProfile(
  supabaseAccessToken: string,
  userUuid: string,
  payload: unknown,
) {
  return fetch(`${apiBase()}/api/vendor/ola/profile/${encodeURIComponent(userUuid)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchVendorOlaOrderDetails(
  supabaseAccessToken: string,
  orderGuid: string,
) {
  return fetch(`${apiBase()}/api/vendor/ola/orders/${encodeURIComponent(orderGuid)}`, {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
    },
  });
}

export async function fetchVendorOlaPharmacies(
  supabaseAccessToken: string,
  params: {
    pharmacyName?: string;
    zipCode?: string;
    pharmacyNcpdpId?: string;
  },
) {
  const search = new URLSearchParams();
  if (params.pharmacyNcpdpId?.trim()) {
    search.set("pharmacy_ncpdp_id", params.pharmacyNcpdpId.trim());
  } else {
    search.set("pharmacy_name", params.pharmacyName?.trim() ?? "");
    search.set("zip_code", params.zipCode?.trim() ?? "");
  }
  return fetch(`${apiBase()}/api/vendor/ola/pharmacies?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
    },
  });
}
