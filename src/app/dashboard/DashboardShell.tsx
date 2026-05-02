import { SignOutButton } from "@/components/SignOutButton";
import type { DashboardPageKey } from "@/lib/dashboard/navigation";
import type { DashboardRole } from "./dashboardAccess";
import { DashboardNav } from "./DashboardNav";
import styles from "./dashboard.module.css";

export function DashboardShell({
  children,
  currentPage,
  email,
  role,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  currentPage: DashboardPageKey;
  email: string;
  role: DashboardRole;
  subtitle?: string;
  title: string;
}) {
  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <p className={styles.brandTitle}>GreyMatter MD</p>
          <p className={styles.brandMeta}>{email}</p>
        </div>
        <DashboardNav role={role} currentPage={currentPage} />
        <div className={styles.sidebarFooter}>
          <SignOutButton noMargin />
        </div>
      </aside>
      <section className={styles.content}>
        <div className={styles.contentInner}>
          <header className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{title}</h1>
            <p className={styles.pageSubtitle}>{subtitle ?? email}</p>
          </header>
          {children}
        </div>
      </section>
    </main>
  );
}
