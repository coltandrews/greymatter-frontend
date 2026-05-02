import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBookingIntent,
  createBookingIntentCheckout,
  reconcileBookingIntentStripe,
  retryBookingIntentOla,
} from "./bookingIntents";

describe("booking intent API helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("creates a booking intent through the backend", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.com/");
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await createBookingIntent("access-token", { serviceState: "SC" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/api/booking-intents", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ serviceState: "SC" }),
    });
  });

  it("starts Stripe checkout for an existing booking intent", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.com");
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await createBookingIntentCheckout("access-token", "booking intent/id");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/booking-intents/booking%20intent%2Fid/checkout",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer access-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("retries Ola booking for a booking intent through the backend", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.com");
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await retryBookingIntentOla("access-token", "booking-id");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/booking-intents/booking-id/retry-ola",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer access-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("reconciles Stripe checkout state for a booking intent through the backend", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.com");
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await reconcileBookingIntentStripe("access-token", "booking-id");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/booking-intents/booking-id/reconcile-stripe",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer access-token",
          Accept: "application/json",
        },
      },
    );
  });
});
