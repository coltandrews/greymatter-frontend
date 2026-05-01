import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchConfigHealth } from "./admin";

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
});
