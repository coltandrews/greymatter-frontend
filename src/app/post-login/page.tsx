import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PostLoginPage() {
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

  const role = profile?.role ?? "patient";

  if (role === "staff" || role === "admin") {
    redirect("/dashboard");
  }

  const { data: profileWithDemographics } = await supabase
    .from("profiles")
    .select("demographics")
    .eq("id", user.id)
    .maybeSingle();
  const demographics = profileWithDemographics?.demographics as
    | { selected_treatment?: unknown }
    | null
    | undefined;
  if (typeof demographics?.selected_treatment === "string" && demographics.selected_treatment) {
    redirect("/checkout");
  }

  redirect("/hub");
}
