export type DashboardRole = "staff" | "admin";
export type DashboardPageKey =
  | "overview"
  | "patients"
  | "appointments"
  | "transactions"
  | "intake"
  | "app-health";

export type DashboardNavItem = {
  label: string;
  href: string;
  active: boolean;
};

const dashboardSections = [
  { key: "overview", label: "Overview", href: "/dashboard" },
  { key: "patients", label: "Patients", href: "/dashboard/patients" },
  { key: "appointments", label: "Appointments", href: "/dashboard/appointments" },
  { key: "transactions", label: "Transactions", href: "/dashboard/transactions" },
  { key: "intake", label: "Intake", href: "/dashboard/intake" },
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
