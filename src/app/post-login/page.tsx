import type { IntakeDraftData } from "@/lib/intake/draftData";
import { postLoginDestination } from "@/lib/auth/postLoginDestination";
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

  redirect(postLoginDestination({
    role: profile?.role,
    draftData: draftRow?.data as IntakeDraftData | undefined,
    profileDemographics: profile?.demographics as IntakeDraftData | undefined,
  }));
}
