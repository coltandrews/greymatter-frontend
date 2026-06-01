import {
  memberProfileComplete,
  type IntakeDraftData,
} from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
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

  const [{ data: profile }, { data: draftRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, demographics")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("intake_drafts")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const role = profile?.role ?? "patient";

  if (role === "staff" || role === "admin") {
    redirect("/hub");
  }

  const demographics = mergeIntakeAndProfileDemographics(
    draftRow?.data as IntakeDraftData | undefined,
    profile?.demographics as IntakeDraftData | undefined,
  );

  if (!memberProfileComplete(demographics)) {
    redirect("/onboarding");
  }

  redirect("/hub");
}
