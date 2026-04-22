import { PatientUserMenu } from "./PatientUserMenu";
import styles from "./patientTopBar.module.css";

export function PatientTopBar({
  welcomeName,
  email,
}: {
  welcomeName: string;
  email: string;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <p className={styles.brandName}>Greymatter</p>
        <p className={styles.brandTag}>Patient hub</p>
      </div>
      <div className={styles.actions}>
        <PatientUserMenu welcomeName={welcomeName} email={email} />
      </div>
    </header>
  );
}
