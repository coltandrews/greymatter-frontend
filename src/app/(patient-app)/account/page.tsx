import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./account.module.css";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <main className={styles.page}>
      <Link href="/hub" className={styles.back}>
        ← Back to Patient Hub
      </Link>

      <div className={styles.card}>
        <h1 className={styles.title}>Account</h1>
        <p className={styles.subtitle}>
          Your sign-in and profile details. More fields and save will be available as we build out
          your care profile.
        </p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="account-email">
            Email
          </label>
          <input
            id="account-email"
            className={styles.input}
            type="email"
            value={user.email ?? ""}
            disabled
            readOnly
            autoComplete="email"
          />
          <p className={styles.hint}>Email is managed through your sign-in provider.</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="account-user-id">
            Patient ID
          </label>
          <input
            id="account-user-id"
            className={styles.input}
            value={user.id}
            disabled
            readOnly
            autoComplete="off"
          />
          <p className={styles.hint}>Internal reference for support.</p>
        </div>

        <p className={styles.stub}>
          Phone, address, insurance, and notification preferences will go here. HIPAA-appropriate
          updates will sync to your care record when integrations are live.
        </p>
      </div>
    </main>
  );
}
