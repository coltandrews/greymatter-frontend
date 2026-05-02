function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return base;
}

export async function createBookingIntent(
  supabaseAccessToken: string,
  payload: unknown,
) {
  return fetch(`${apiBase()}/api/booking-intents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function createBookingIntentCheckout(
  supabaseAccessToken: string,
  bookingIntentId: string,
) {
  return fetch(
    `${apiBase()}/api/booking-intents/${encodeURIComponent(bookingIntentId)}/checkout`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseAccessToken}`,
        Accept: "application/json",
      },
    },
  );
}

export async function retryBookingIntentOla(
  supabaseAccessToken: string,
  bookingIntentId: string,
) {
  return fetch(
    `${apiBase()}/api/booking-intents/${encodeURIComponent(bookingIntentId)}/retry-ola`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseAccessToken}`,
        Accept: "application/json",
      },
    },
  );
}

export async function reconcileBookingIntentStripe(
  supabaseAccessToken: string,
  bookingIntentId: string,
) {
  return fetch(
    `${apiBase()}/api/booking-intents/${encodeURIComponent(bookingIntentId)}/reconcile-stripe`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseAccessToken}`,
        Accept: "application/json",
      },
    },
  );
}
