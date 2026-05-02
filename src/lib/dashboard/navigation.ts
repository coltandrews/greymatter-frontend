export type DashboardRole = "staff" | "admin";
export type DashboardPageKey =
  | "overview"
  | "patients"
  | "booking-queue"
  | "submissions"
  | "recovery"
  | "deployment-health";

export type DashboardNavItem = {
  label: string;
  href: string;
  active: boolean;
};

const dashboardSections = [
  { key: "overview", label: "Overview", href: "/dashboard" },
  { key: "patients", label: "Patients", href: "/dashboard/patients" },
  { key: "booking-queue", label: "Booking queue", href: "/dashboard/booking-queue" },
  { key: "submissions", label: "Submissions", href: "/dashboard/submissions" },
  { key: "recovery", label: "Recovery", href: "/dashboard/recovery" },
] as const;

export function dashboardNavItems(
  role: DashboardRole,
  currentPage: DashboardPageKey,
): DashboardNavItem[] {
  const items: DashboardNavItem[] = dashboardSections.map((section) => ({
    label: section.label,
    href: section.href,
    active: currentPage === section.key,
  }));

  if (role === "admin") {
    items.push({
      label: "Deployment health",
      href: "/dashboard/deployment-health",
      active: currentPage === "deployment-health",
    });
  }

  return items;
}
