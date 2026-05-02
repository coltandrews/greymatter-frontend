import { describe, expect, it } from "vitest";
import { dashboardNavItems } from "./navigation";

describe("dashboardNavItems", () => {
  it("hides deployment health from staff users", () => {
    expect(dashboardNavItems("staff", "dashboard").map((item) => item.label))
      .not.toContain("Deployment health");
  });

  it("uses same-page section links on the dashboard", () => {
    expect(dashboardNavItems("admin", "dashboard").slice(0, 2)).toEqual([
      { label: "Overview", href: "#overview", active: false },
      { label: "Patients", href: "#patients", active: false },
    ]);
  });

  it("shows deployment health to admins", () => {
    expect(dashboardNavItems("admin", "dashboard")).toContainEqual({
      label: "Deployment health",
      href: "/dashboard/deployment-health",
      active: false,
    });
  });

  it("links back to dashboard sections from the deployment health page", () => {
    expect(dashboardNavItems("admin", "deployment-health").slice(0, 2)).toEqual([
      { label: "Overview", href: "/dashboard#overview", active: false },
      { label: "Patients", href: "/dashboard#patients", active: false },
    ]);
  });
});
