import { SignOutButton } from "@/components/SignOutButton";
import type { DashboardPageKey } from "@/lib/dashboard/navigation";
import type { DashboardRole } from "./dashboardAccess";
import { DashboardNav } from "./DashboardNav";

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
    <main
      style={{
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        minHeight: "100vh",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 960,
          padding: 28,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5ebf5",
        }}
      >
        <header style={{ textAlign: "center" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>{title}</h1>
          <p style={{ margin: "0 0 8px", fontSize: 14, color: "#64748b" }}>
            {subtitle ?? email}
          </p>
          {subtitle ? (
            <p style={{ margin: "0 0 20px", fontSize: 12, color: "#94a3b8" }}>
              {email}
            </p>
          ) : null}
        </header>

        <DashboardNav role={role} currentPage={currentPage} />

        {children}

        <div style={{ marginTop: 24 }}>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
