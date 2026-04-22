"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./patientUserMenu.module.css";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function PatientUserMenu({
  welcomeName,
  email,
}: {
  welcomeName: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${email}`}
        onClick={() => setOpen((v) => !v)}
        title={email}
      >
        <span className={styles.welcome}>
          Welcome, <span className={styles.name}>{welcomeName}</span>
        </span>
        <Chevron open={open} />
      </button>

      {open ? (
        <div className={styles.dropdown} role="menu" aria-label="Account">
          <p className={styles.dropdownEmail} title={email}>
            {email}
          </p>
          <Link
            href="/account"
            className={styles.menuLink}
            role="menuitem"
            onClick={close}
          >
            Account
          </Link>
          <div className={styles.menuFooter}>
            <div className={styles.signOutWrap}>
              <SignOutButton noMargin menuItem />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
