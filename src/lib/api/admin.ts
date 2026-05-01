function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return base;
}

export type ConfigHealthStatus = "ok" | "warning" | "error";

export type ConfigHealthCheck = {
  key: string;
  label: string;
  status: ConfigHealthStatus;
  message: string;
};

export type ConfigHealthResponse = {
  status: "ok" | "degraded";
  checkedAt: string;
  checks: ConfigHealthCheck[];
};

export async function fetchConfigHealth(supabaseAccessToken: string) {
  return fetch(`${apiBase()}/api/admin/config-health`, {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
    },
  });
}
