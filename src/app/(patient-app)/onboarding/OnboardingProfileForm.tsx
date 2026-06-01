"use client";

import {
  memberProfileComplete,
  type IntakeDraftData,
} from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { syncProfileDemographics } from "@/lib/intake/syncProfileDemographics";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import styles from "./onboarding.module.css";

type FormState = {
  legal_first_name: string;
  legal_last_name: string;
  preferred_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
};

function fromDraft(data: IntakeDraftData): FormState {
  return {
    legal_first_name: data.legal_first_name?.trim() ?? "",
    legal_last_name: data.legal_last_name?.trim() ?? "",
    preferred_name: data.preferred_name?.trim() ?? "",
    date_of_birth: data.date_of_birth?.trim() ?? "",
    gender: typeof data.gender === "string" ? data.gender : "",
    phone: data.phone?.trim() ?? "",
  };
}

function toDraftPatch(form: FormState): IntakeDraftData {
  return {
    legal_first_name: form.legal_first_name.trim() || undefined,
    legal_last_name: form.legal_last_name.trim() || undefined,
    preferred_name: form.preferred_name.trim() || undefined,
    date_of_birth: form.date_of_birth.trim() || undefined,
    gender: form.gender.trim() || undefined,
    phone: form.phone.trim() || undefined,
    country: "US",
  };
}

export function OnboardingProfileForm({
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

  const setField =
    (key: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
      setError(null);
    };

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);

      const patch = toDraftPatch(form);
      if (!memberProfileComplete(patch)) {
        setError("Complete your legal name, date of birth, sex assigned at birth, and phone.");
        return;
      }

      setSaving(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSaving(false);
        setError("Sign in again to continue.");
        return;
      }

      const [{ data: row, error: draftError }, { data: profile }] = await Promise.all([
        supabase
          .from("intake_drafts")
          .select("step, data")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("profiles").select("demographics").eq("id", user.id).maybeSingle(),
      ]);
      if (draftError) {
        setSaving(false);
        setError(draftError.message);
        return;
      }

      const prior = mergeIntakeAndProfileDemographics(
        (row?.data as IntakeDraftData | undefined) ?? initialData,
        profile?.demographics as IntakeDraftData | undefined,
      );
      const data: IntakeDraftData = { ...prior, ...patch };

      const { error: upsertError } = await supabase.from("intake_drafts").upsert(
        {
          user_id: user.id,
          step: row?.step ?? initialStep ?? "account_onboarding",
          data,
        },
        { onConflict: "user_id" },
      );
      if (upsertError) {
        setSaving(false);
        setError(upsertError.message);
        return;
      }

      const { error: profileError } = await syncProfileDemographics(supabase, user.id, data);
      if (profileError) {
        setSaving(false);
        setError(`Could not save your profile: ${profileError}`);
        return;
      }

      router.push("/hub");
      router.refresh();
    },
    [form, initialData, initialStep, router],
  );

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.readOnly}>
        <div>
          <span>Email</span>
          <strong>{email}</strong>
        </div>
        <div>
          <span>Patient ID</span>
          <strong>{patientId}</strong>
        </div>
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          Legal first name *
          <input
            className={styles.input}
            required
            autoComplete="given-name"
            value={form.legal_first_name}
            onChange={setField("legal_first_name")}
          />
        </label>
        <label className={styles.field}>
          Legal last name *
          <input
            className={styles.input}
            required
            autoComplete="family-name"
            value={form.legal_last_name}
            onChange={setField("legal_last_name")}
          />
        </label>
        <label className={styles.field}>
          Preferred name
          <input
            className={styles.input}
            autoComplete="nickname"
            value={form.preferred_name}
            onChange={setField("preferred_name")}
          />
        </label>
        <label className={styles.field}>
          Date of birth *
          <input
            className={styles.input}
            type="date"
            required
            autoComplete="bday"
            value={form.date_of_birth}
            onChange={setField("date_of_birth")}
          />
        </label>
        <label className={styles.field}>
          Sex assigned at birth *
          <select
            className={styles.input}
            required
            value={form.gender}
            onChange={setField("gender")}
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label className={styles.field}>
          Phone *
          <input
            className={styles.input}
            required
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={setField("phone")}
          />
        </label>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={saving} aria-busy={saving}>
        {saving ? "Saving profile..." : "Continue to dashboard"}
      </button>
    </form>
  );
}
