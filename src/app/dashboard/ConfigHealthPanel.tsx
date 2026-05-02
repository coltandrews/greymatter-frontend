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
import styles from "./dashboard.module.css";

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
        throw new Error("Sign in again to check app health.");
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
  const errorCount = checks.filter((check) => check.status === "error").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;
  const healthyCount = checks.filter((check) => check.status === "ok").length;

  return (
    <section className={styles.healthPanel} aria-labelledby="config-health-title">
      <div className={styles.healthHeader}>
        <div className={styles.healthIntro}>
          <p className={styles.healthEyebrow}>Service Readiness</p>
          <h2 id="config-health-title" className={styles.healthTitle}>
            App Health
          </h2>
          <p className={styles.healthSummary}>
            {loading ? "Checking backend configuration..." : configHealthSummary(health)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadHealth();
          }}
          disabled={loading}
          className={styles.healthRefresh}
        >
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>

      <div className={styles.healthStats}>
        <div className={styles.healthStat}>
          <p className={styles.healthStatLabel}>Healthy</p>
          <p className={styles.healthStatValue}>{healthyCount}</p>
        </div>
        <div className={styles.healthStat}>
          <p className={styles.healthStatLabel}>Warnings</p>
          <p className={styles.healthStatValue}>{warningCount}</p>
        </div>
        <div className={styles.healthStat}>
          <p className={styles.healthStatLabel}>Errors</p>
          <p className={styles.healthStatValue}>{errorCount}</p>
        </div>
      </div>

      {health ? (
        <p className={styles.healthChecked}>
          Checked {formatCheckedAt(health.checkedAt)}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className={styles.healthError}>
          {error}
        </p>
      ) : null}

      {checks.length > 0 ? (
        <div className={styles.healthTableWrap}>
          <table className={styles.healthTable}>
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Check</th>
                <th scope="col">Message</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((check) => {
                const view = configHealthStatusView(check.status);
                const statusClass = check.status === "ok"
                  ? styles.healthStatusOk
                  : styles.healthStatusError;

                return (
                  <tr key={check.key}>
                    <td>
                      <span className={`${styles.healthStatus} ${statusClass}`}>
                        <span className={styles.healthStatusDot} aria-hidden="true" />
                        {view.label}
                      </span>
                    </td>
                    <td className={styles.healthCheckName}>{check.label}</td>
                    <td className={styles.healthCheckMessage}>{check.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
