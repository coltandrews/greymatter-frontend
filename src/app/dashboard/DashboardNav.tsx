import Link from "next/link";
import {
  dashboardNavItems,
  type DashboardPageKey,
  type DashboardRole,
} from "@/lib/dashboard/navigation";

export function DashboardNav({
  role,
  currentPage,
}: {
  role: DashboardRole;
  currentPage: DashboardPageKey;
}) {
  const items = dashboardNavItems(role, currentPage);

  return (
    <nav
      aria-label="Dashboard sections"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        margin: "0 0 24px",
        padding: "10px",
        border: "1px solid #e5ebf5",
        borderRadius: 12,
        background: "#f8fafc",
      }}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 36,
            padding: "0 12px",
            borderRadius: 9,
            border: item.active ? "1px solid #172033" : "1px solid #e5ebf5",
            background: item.active ? "#172033" : "#fff",
            color: item.active ? "#fff" : "#172033",
            fontSize: 13,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
