import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ScheduleFlow } from "./ScheduleFlow";
import styles from "./schedule.module.css";

type DraftData = {
  service_state?: string;
};

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: draft } = await supabase
    .from("intake_drafts")
    .select("data")
    .eq("user_id", user.id)
    .maybeSingle();

  const data = draft?.data as DraftData | undefined;
  const serviceState = data?.service_state?.trim() || null;

  const serviceId =
    process.env.NEXT_PUBLIC_OLA_SERVICE_ID?.trim() || "placeholder-service-id";

  return (
    <main className={styles.page}>
      <Link href="/hub" className={styles.back}>
        ← Patient Hub
      </Link>
      <ScheduleFlow serviceState={serviceState} serviceId={serviceId} />
    </main>
  );
}
