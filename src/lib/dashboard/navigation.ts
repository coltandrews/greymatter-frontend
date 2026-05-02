export type DashboardRole = "staff" | "admin";
export type DashboardPageKey =
  | "overview"
  | "patients"
  | "booking-queue"
  | "submissions"
  | "booking-issues"
  | "app-health";

export type DashboardNavItem = {
  label: string;
  href: string;
  active: boolean;
};

const dashboardSections = [
  { key: "overview", label: "Overview", href: "/dashboard" },
  { key: "patients", label: "Patients", href: "/dashboard/patients" },
  { key: "booking-queue", label: "Booking Queue", href: "/dashboard/booking-queue" },
  { key: "submissions", label: "Submissions", href: "/dashboard/submissions" },
  { key: "booking-issues", label: "Booking Issues", href: "/dashboard/booking-issues" },
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
      label: "App Health",
      href: "/dashboard/app-health",
      active: currentPage === "app-health",
    });
  }

  return items;
}
