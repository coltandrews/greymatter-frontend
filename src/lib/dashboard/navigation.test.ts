import { describe, expect, it } from "vitest";
import { dashboardNavItems } from "./navigation";

describe("dashboardNavItems", () => {
  it("hides deployment health from staff users", () => {
    expect(dashboardNavItems("staff", "overview").map((item) => item.label))
      .not.toContain("Deployment health");
  });

  it("uses page links for dashboard sections", () => {
    expect(dashboardNavItems("admin", "overview").slice(0, 3)).toEqual([
      { label: "Overview", href: "/dashboard", active: true },
      { label: "Patients", href: "/dashboard/patients", active: false },
      { label: "Booking queue", href: "/dashboard/booking-queue", active: false },
    ]);
  });

  it("shows deployment health to admins", () => {
    expect(dashboardNavItems("admin", "overview")).toContainEqual({
      label: "Deployment health",
      href: "/dashboard/deployment-health",
      active: false,
    });
  });

  it("marks deployment health active on the deployment health page", () => {
    expect(dashboardNavItems("admin", "deployment-health").slice(0, 2)).toEqual([
      { label: "Overview", href: "/dashboard", active: false },
      { label: "Patients", href: "/dashboard/patients", active: false },
    ]);
    expect(dashboardNavItems("admin", "deployment-health").at(-1)).toEqual({
      label: "Deployment health",
      href: "/dashboard/deployment-health",
      active: true,
    });
  });
});
