export type DashboardRole = "staff" | "admin";
export type DashboardPageKey = "dashboard" | "deployment-health";

export type DashboardNavItem = {
  label: string;
  href: string;
  active: boolean;
};

const dashboardSections = [
  { label: "Overview", id: "overview" },
  { label: "Patients", id: "patients" },
  { label: "Booking queue", id: "booking-queue" },
  { label: "Submissions", id: "submissions" },
  { label: "Recovery", id: "recovery" },
] as const;

export function dashboardNavItems(
  role: DashboardRole,
  currentPage: DashboardPageKey,
): DashboardNavItem[] {
  const dashboardPrefix = currentPage === "dashboard" ? "" : "/dashboard";
  const items: DashboardNavItem[] = dashboardSections.map((section) => ({
    label: section.label,
    href: `${dashboardPrefix}#${section.id}`,
    active: false,
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
