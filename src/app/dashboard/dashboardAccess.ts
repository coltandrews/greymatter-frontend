import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type DashboardRole = "staff" | "admin";

export async function requireDashboardAccess({
  adminOnly = false,
}: {
  adminOnly?: boolean;
} = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role: DashboardRole | null =
    profile?.role === "admin" ? "admin" : profile?.role === "staff" ? "staff" : null;
  if (!role) {
    redirect("/hub");
  }
  if (adminOnly && role !== "admin") {
    redirect("/dashboard");
  }

  return {
    role,
    supabase,
    user,
  };
}
