"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

export function PatientSidebar({
  email,
  intakeComplete,
}: {
  email: string;
  intakeComplete: boolean;
}) {
  const nav = [
    { href: "/home", label: "Home" },
    { href: "/hub", label: "My visits" },
    ...(intakeComplete ? [] : [{ href: "/intake", label: "Intake" as const }]),
  ];
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        padding: "24px 16px",
        background: "#fff",
        borderRight: "1px solid #e5ebf5",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#172033",
            textTransform: "uppercase" as const,
          }}
        >
          Greymatter
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          Patient
        </p>
      </div>

      <nav style={{ display: "grid", gap: 4 }}>
        {nav.map(({ href, label }: { href: string; label: string }) => {
          const isActive =
            href === "/home"
              ? pathname === "/home"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#172033" : "#475569",
                background: isActive ? "#f1f5f9" : "transparent",
                textDecoration: "none",
                borderLeft: isActive ? "3px solid #172033" : "3px solid transparent",
                marginLeft: -3,
                paddingLeft: isActive ? 12 : 15,
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 12,
            color: "#64748b",
            wordBreak: "break-word" as const,
            paddingLeft: 3,
          }}
        >
          {email}
        </p>
        <SignOutButton noMargin />
      </div>
    </aside>
  );
}
