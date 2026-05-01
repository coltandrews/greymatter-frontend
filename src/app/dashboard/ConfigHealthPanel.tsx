"use client";

import {
  fetchConfigHealth,
  type ConfigHealthResponse,
} from "@/lib/api/admin";
import {
  configHealthStatusView,
  configHealthSummary,
  sortConfigHealthChecks,
} from "@/lib/dashboard/configHealth";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";

function formatCheckedAt(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

async function readBackendMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null) as { message?: unknown } | null;
  return typeof body?.message === "string" && body.message.trim()
    ? body.message
    : `Config health check failed (${res.status}).`;
}

export function ConfigHealthPanel() {
  const [health, setHealth] = useState<ConfigHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHealth() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to check deployment health.");
      }

      const response = await fetchConfigHealth(session.access_token);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }

      setHealth(await response.json() as ConfigHealthResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load config health.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  const checks = useMemo(
    () => sortConfigHealthChecks(health?.checks ?? []),
    [health],
  );

  return (
    <section style={{ margin: "0 0 24px" }} aria-labelledby="config-health-title">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <h2 id="config-health-title" style={{ margin: "0 0 6px", fontSize: 18 }}>
            Deployment health
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            {loading ? "Checking backend configuration..." : configHealthSummary(health)}
          </p>
          {health ? (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
              Checked {formatCheckedAt(health.checkedAt)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            void loadHealth();
          }}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #dbe3ef",
            background: loading ? "#f1f5f9" : "#fff",
            color: "#172033",
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <p role="alert" style={{ margin: "0 0 12px", color: "#b91c1c", fontSize: 14 }}>
          {error}
        </p>
      ) : null}

      {checks.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          {checks.map((check) => {
            const view = configHealthStatusView(check.status);
            return (
              <article
                key={check.key}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid #e5ebf5",
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 14, color: "#172033" }}>
                    {check.label}
                  </h3>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: view.background,
                      color: view.color,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {view.label}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "#64748b" }}>
                  {check.message}
                </p>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
