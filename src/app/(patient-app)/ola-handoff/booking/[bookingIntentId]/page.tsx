import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import styles from "../../[appointmentId]/olaHandoff.module.css";

type Props = {
  params: Promise<{ bookingIntentId: string }>;
};

function formatWhen(selectedSlot: unknown) {
  if (!selectedSlot || typeof selectedSlot !== "object") {
    return null;
  }

  const slot = selectedSlot as Record<string, unknown>;
  const start = typeof slot.start === "string" ? slot.start : "";
  if (!start) {
    return null;
  }

  try {
    return new Date(start).toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return start;
  }
}

function providerName(selectedSlot: unknown): string {
  if (!selectedSlot || typeof selectedSlot !== "object") {
    return "Ola provider network";
  }
  const provider = (selectedSlot as Record<string, unknown>).providerName;
  return typeof provider === "string" && provider.trim()
    ? provider.trim()
    : "Ola provider network";
}

export default async function OlaBookingHandoffPage({ params }: Props) {
  const { bookingIntentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: bookingIntent } = await supabase
    .from("booking_intents")
    .select("id, selected_slot, ola_redirect_url")
    .eq("id", bookingIntentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!bookingIntent?.ola_redirect_url) {
    notFound();
  }

  const when = formatWhen(bookingIntent.selected_slot);

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
            <dd>{providerName(bookingIntent.selected_slot)}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Link href="/hub" className={styles.secondary}>
            Back to hub
          </Link>
          <a
            href={bookingIntent.ola_redirect_url}
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
