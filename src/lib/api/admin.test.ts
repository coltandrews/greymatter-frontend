import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAuditNote,
  fetchAuditEvents,
  fetchBookingQueue,
  fetchConfigHealth,
  fetchPatientLookup,
  fetchTransactions,
} from "./admin";

describe("admin API helpers", () => {
  const originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalBase;
    vi.restoreAllMocks();
  });

  it("fetches staff config health through the backend", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/";
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchConfigHealth("access-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/admin/config-health",
      {
        headers: {
          Authorization: "Bearer access-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("fetches the staff booking queue through the backend", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchBookingQueue("access-token", 50);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/admin/booking-queue?limit=50",
      {
        headers: {
          Authorization: "Bearer access-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("fetches staff transactions through the backend", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchTransactions("access-token", 25);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/admin/transactions?limit=25",
      {
        headers: {
          Authorization: "Bearer access-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("searches patients through the backend", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPatientLookup("access-token", "pat@example.com");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/admin/patient-lookup?q=pat%40example.com",
      {
        headers: {
          Authorization: "Bearer access-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("fetches audit events by booking intent", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAuditEvents("access-token", { bookingIntentId: "booking-1", limit: 10 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/admin/audit-events?booking_intent_id=booking-1&limit=10",
      {
        headers: {
          Authorization: "Bearer access-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("creates staff audit notes through the backend", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await createAuditNote("access-token", {
      patientUserId: "patient-1",
      note: "Called patient",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/admin/audit-events",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer access-token",
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientUserId: "patient-1",
          note: "Called patient",
        }),
      },
    );
  });
});
