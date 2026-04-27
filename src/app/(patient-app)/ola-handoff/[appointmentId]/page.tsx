import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import styles from "./olaHandoff.module.css";

type Props = {
  params: Promise<{ appointmentId: string }>;
};

function formatWhen(iso: string | null) {
  if (!iso) {
    return null;
  }
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default async function OlaHandoffPage({ params }: Props) {
  const { appointmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, starts_at, provider_name, ola_redirect_url")
    .eq("id", appointmentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!appointment?.ola_redirect_url) {
    notFound();
  }

  const when = formatWhen(appointment.starts_at);

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="handoff-title">
        <div className={styles.icon} aria-hidden>
          →
        </div>
        <p className={styles.eyebrow}>One more step</p>
        <h1 id="handoff-title" className={styles.title}>
          Continue with our care partner
        </h1>
        <p className={styles.lead}>
          Greymatter uses Ola&apos;s provider network for secure visit documents and identity
          verification.
        </p>
        <p className={styles.body}>
          You may be asked to create or sign in to an Ola account before viewing the next step for
          this appointment. That account is separate from your Greymatter login and helps the care
          team keep your clinical information protected.
        </p>
        <dl className={styles.details}>
          {when ? (
            <div>
              <dt>Appointment</dt>
              <dd>{when}</dd>
            </div>
          ) : null}
          <div>
            <dt>Provider</dt>
            <dd>{appointment.provider_name?.trim() || "Ola provider network"}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Link href="/hub" className={styles.secondary}>
            Back to hub
          </Link>
          <a
            href={appointment.ola_redirect_url}
            className={styles.primary}
            target="_blank"
            rel="noreferrer"
          >
            Continue to Ola
          </a>
        </div>
      </section>
    </main>
  );
}
