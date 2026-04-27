"use client";

import { US_STATES } from "@/app/intake/usStates";
import {
  type IntakeDraftData,
} from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { syncProfileDemographics } from "@/lib/intake/syncProfileDemographics";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import styles from "./account.module.css";

type FormState = {
  gender: string;
  address_state: string;
};

function fromDraft(d: IntakeDraftData | undefined): FormState {
  return {
    gender: typeof d?.gender === "string" ? d.gender : "",
    address_state: d?.service_state?.trim() || d?.address_state?.trim() || "",
  };
}

function toDraftPatch(f: FormState): IntakeDraftData {
  const state = f.address_state.trim() || undefined;
  return {
    gender: f.gender.trim() || undefined,
    address_state: state,
    service_state: state,
  };
}

export function AccountProfileForm({
  email,
  patientId,
  initialStep,
  initialData,
}: {
  email: string;
  patientId: string;
  initialStep: string;
  initialData: IntakeDraftData;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => fromDraft(initialData));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSaved(false);
      const patch = toDraftPatch(form);
      if (!patch.gender || !patch.address_state) {
        setError("Please choose gender and state.");
        return;
      }

      setSaving(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSaving(false);
        setError("Not signed in.");
        return;
      }

      const [{ data: row, error: fetchErr }, { data: prof }] = await Promise.all([
        supabase
          .from("intake_drafts")
          .select("step, data")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("profiles").select("demographics").eq("id", user.id).maybeSingle(),
      ]);

      if (fetchErr) {
        setSaving(false);
        setError(fetchErr.message);
        return;
      }

      const step = row?.step ?? initialStep ?? "paused_before_scheduling";
      const prior = mergeIntakeAndProfileDemographics(
        (row?.data as IntakeDraftData | undefined) ?? initialData,
        prof?.demographics as IntakeDraftData | undefined,
      );
      const data: IntakeDraftData = { ...prior, ...patch };

      const { error: upErr } = await supabase.from("intake_drafts").upsert(
        {
          user_id: user.id,
          step,
          data,
        },
        { onConflict: "user_id" },
      );

      setSaving(false);
      if (upErr) {
        setError(upErr.message);
        return;
      }

      const { error: syncErr } = await syncProfileDemographics(supabase, user.id, data);
      if (syncErr) {
        setError(`Could not update profile: ${syncErr}`);
        return;
      }

      setSaved(true);
      router.refresh();
    },
    [form, initialData, initialStep, router],
  );

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setForm((p) => ({ ...p, [key]: e.target.value }));
      setSaved(false);
    };

  return (
    <form className={styles.profileForm} onSubmit={onSave}>
      <div className={styles.readOnlyBlock}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="account-email">
            Email
          </label>
          <input
            id="account-email"
            className={`${styles.input} ${styles.inputReadonly}`}
            type="email"
            value={email}
            disabled
            readOnly
            autoComplete="email"
          />
          <p className={styles.hint}>
            Sign-in email is managed by your account provider. Contact support to change it.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="account-user-id">
            Patient ID
          </label>
          <input
            id="account-user-id"
            className={`${styles.input} ${styles.inputReadonly}`}
            value={patientId}
            disabled
            readOnly
            autoComplete="off"
          />
        </div>
      </div>

      <p className={styles.sectionLead}>Profile settings</p>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-gender">
            Gender *
          </label>
          <select
            id="acct-gender"
            className={styles.inputEditable}
            required
            value={form.gender}
            onChange={set("gender")}
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non_binary">Non-binary</option>
            <option value="prefer_not">Prefer not to say</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-state">
            State *
          </label>
          <select
            id="acct-state"
            className={styles.inputEditable}
            required
            autoComplete="address-level1"
            value={form.address_state}
            onChange={set("address_state")}
          >
            <option value="">Select…</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className={styles.formSuccess} role="status">
          Your details were saved.
        </p>
      ) : null}

      <button
        type="submit"
        className={styles.saveBtn}
        disabled={saving}
        aria-busy={saving}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
