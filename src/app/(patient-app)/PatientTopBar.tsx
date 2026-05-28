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
        <img src="/brand/logo-horizontal.svg" alt="GMMD" className={styles.logo} />
      </div>
      <div className={styles.actions}>
        <PatientUserMenu welcomeName={welcomeName} email={email} />
      </div>
    </header>
  );
}
