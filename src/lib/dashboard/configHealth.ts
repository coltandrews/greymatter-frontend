import type {
  ConfigHealthCheck,
  ConfigHealthResponse,
  ConfigHealthStatus,
} from "@/lib/api/admin";

export type ConfigHealthView = {
  label: string;
  color: string;
  background: string;
};

const statusViews: Record<ConfigHealthStatus, ConfigHealthView> = {
  ok: {
    label: "OK",
    color: "#166534",
    background: "#dcfce7",
  },
  warning: {
    label: "Warning",
    color: "#92400e",
    background: "#fef3c7",
  },
  error: {
    label: "Needs attention",
    color: "#991b1b",
    background: "#fee2e2",
  },
};

export function configHealthStatusView(status: ConfigHealthStatus): ConfigHealthView {
  return statusViews[status];
}

export function configHealthSummary(health: ConfigHealthResponse | null): string {
  if (!health) {
    return "Not checked yet.";
  }
  const errors = health.checks.filter((check) => check.status === "error").length;
  const warnings = health.checks.filter((check) => check.status === "warning").length;
  if (errors > 0) {
    return errors === 1
      ? "1 issue needs attention."
      : `${errors} issues need attention.`;
  }
  if (warnings > 0) {
    return `${warnings} warning${warnings === 1 ? "" : "s"} to review.`;
  }
  return "All deployment checks are passing.";
}

export function sortConfigHealthChecks(checks: ConfigHealthCheck[]): ConfigHealthCheck[] {
  const weight: Record<ConfigHealthStatus, number> = {
    error: 0,
    warning: 1,
    ok: 2,
  };
  return [...checks].sort((a, b) => weight[a.status] - weight[b.status]);
}
