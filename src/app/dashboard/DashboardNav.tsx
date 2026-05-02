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
        justifyContent: "center",
        gap: 8,
        margin: "0 auto 28px",
        padding: 8,
        border: "1px solid #e5ebf5",
        borderRadius: 999,
        background: "#f8fafc",
        boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
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
            justifyContent: "center",
            minHeight: 38,
            padding: "0 16px",
            borderRadius: 999,
            border: item.active ? "1px solid #172033" : "1px solid transparent",
            background: item.active ? "#172033" : "transparent",
            color: item.active ? "#fff" : "#172033",
            fontSize: 13,
            fontWeight: 800,
            textDecoration: "none",
            boxShadow: item.active ? "0 6px 18px rgba(23, 32, 51, 0.16)" : "none",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
