import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import styles from "./patientTopBar.module.css";

export function PatientTopBar({ email }: { email: string }) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <p className={styles.brandName}>Greymatter</p>
        <p className={styles.brandTag}>Patient hub</p>
      </div>
      <div className={styles.actions}>
        <div className={styles.emailWrap}>
          <span className={styles.emailHint}>Account</span>
          <Link href="/account" className={styles.emailLink} title="Edit account">
            {email}
          </Link>
        </div>
        <SignOutButton noMargin />
      </div>
    </header>
  );
}
