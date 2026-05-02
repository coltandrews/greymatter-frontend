import Link from "next/link";
import {
  dashboardNavItems,
  type DashboardPageKey,
  type DashboardRole,
} from "@/lib/dashboard/navigation";
import styles from "./dashboard.module.css";

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
      className={styles.nav}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`${styles.navLink} ${item.active ? styles.navLinkActive : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
