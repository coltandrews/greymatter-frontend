import { describe, expect, it } from "vitest";
import { dashboardNavItems } from "./navigation";

describe("dashboardNavItems", () => {
  it("hides app health from staff users", () => {
    expect(dashboardNavItems("staff", "overview").map((item) => item.label))
      .not.toContain("App Health");
  });

  it("uses page links for dashboard sections", () => {
    expect(dashboardNavItems("admin", "overview").slice(0, 4)).toEqual([
      { label: "Overview", href: "/dashboard", active: true },
      { label: "Patients", href: "/dashboard/patients", active: false },
      { label: "Care Activity", href: "/dashboard/appointments", active: false },
      { label: "Transactions", href: "/dashboard/transactions", active: false },
    ]);
  });

  it("marks appointments active", () => {
    expect(dashboardNavItems("staff", "appointments")).toContainEqual({
      label: "Care Activity",
      href: "/dashboard/appointments",
      active: true,
    });
  });

  it("shows app health to admins", () => {
    expect(dashboardNavItems("admin", "overview")).toContainEqual({
      label: "App Health",
      href: "/dashboard/app-health",
      active: false,
    });
  });

  it("marks transactions active", () => {
    expect(dashboardNavItems("staff", "transactions")).toContainEqual({
      label: "Transactions",
      href: "/dashboard/transactions",
      active: true,
    });
  });

  it("marks app health active on the app health page", () => {
    expect(dashboardNavItems("admin", "app-health").slice(0, 4)).toEqual([
      { label: "Overview", href: "/dashboard", active: false },
      { label: "Patients", href: "/dashboard/patients", active: false },
      { label: "Care Activity", href: "/dashboard/appointments", active: false },
      { label: "Transactions", href: "/dashboard/transactions", active: false },
    ]);
    expect(dashboardNavItems("admin", "app-health").at(-1)).toEqual({
      label: "App Health",
      href: "/dashboard/app-health",
      active: true,
    });
  });
});
