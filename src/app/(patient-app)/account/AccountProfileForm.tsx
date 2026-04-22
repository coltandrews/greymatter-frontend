"use client";

import { US_STATES } from "@/app/intake/usStates";
import {
  basicInfoComplete,
  type IntakeDraftData,
} from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { syncProfileDemographics } from "@/lib/intake/syncProfileDemographics";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import styles from "./account.module.css";

type FormState = {
  legal_first_name: string;
  legal_last_name: string;
  preferred_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  phone_secondary: string;
  street_address: string;
  address_line2: string;
  city: string;
  address_state: string;
  zip: string;
  country: string;
};

function fromDraft(d: IntakeDraftData | undefined): FormState {
  return {
    legal_first_name: d?.legal_first_name ?? "",
    legal_last_name: d?.legal_last_name ?? "",
    preferred_name: d?.preferred_name ?? "",
    date_of_birth: d?.date_of_birth ?? "",
    gender: typeof d?.gender === "string" ? d.gender : "",
    phone: d?.phone ?? "",
    phone_secondary: d?.phone_secondary ?? "",
    street_address: d?.street_address ?? "",
    address_line2: d?.address_line2 ?? "",
    city: d?.city ?? "",
    address_state: d?.address_state ?? "",
    zip: d?.zip ?? "",
    country: d?.country?.trim() || "US",
  };
}

function toDraftPatch(f: FormState): IntakeDraftData {
  return {
    legal_first_name: f.legal_first_name.trim() || undefined,
    legal_last_name: f.legal_last_name.trim() || undefined,
    preferred_name: f.preferred_name.trim() || undefined,
    date_of_birth: f.date_of_birth.trim() || undefined,
    gender: f.gender.trim() || undefined,
    phone: f.phone.trim() || undefined,
    phone_secondary: f.phone_secondary.trim() || undefined,
    street_address: f.street_address.trim() || undefined,
    address_line2: f.address_line2.trim() || undefined,
    city: f.city.trim() || undefined,
    address_state: f.address_state.trim() || undefined,
    zip: f.zip.trim() || undefined,
    country: f.country.trim() || "US",
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

  const maxDob = new Date().toISOString().slice(0, 10);
  const minDob = new Date(new Date().getFullYear() - 120, 0, 1)
    .toISOString()
    .slice(0, 10);

  const onSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSaved(false);
      const patch = toDraftPatch(form);
      const mergedForCheck: IntakeDraftData = { ...initialData, ...patch };
      if (!basicInfoComplete(mergedForCheck)) {
        setError(
          "Please complete all required fields. Phone needs at least 10 digits.",
        );
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
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

      <p className={styles.sectionLead}>Your details</p>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-first">
            Legal first name *
          </label>
          <input
            id="acct-first"
            className={styles.inputEditable}
            required
            autoComplete="given-name"
            value={form.legal_first_name}
            onChange={set("legal_first_name")}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-last">
            Legal last name *
          </label>
          <input
            id="acct-last"
            className={styles.inputEditable}
            required
            autoComplete="family-name"
            value={form.legal_last_name}
            onChange={set("legal_last_name")}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="acct-preferred">
          Preferred name (optional)
        </label>
        <input
          id="acct-preferred"
          className={styles.inputEditable}
          autoComplete="nickname"
          value={form.preferred_name}
          onChange={set("preferred_name")}
        />
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-dob">
            Date of birth *
          </label>
          <input
            id="acct-dob"
            type="date"
            className={styles.inputEditable}
            required
            min={minDob}
            max={maxDob}
            value={form.date_of_birth}
            onChange={set("date_of_birth")}
          />
        </div>
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
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-phone">
            Primary phone *
          </label>
          <input
            id="acct-phone"
            type="tel"
            className={styles.inputEditable}
            required
            autoComplete="tel"
            value={form.phone}
            onChange={set("phone")}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-phone2">
            Secondary phone (optional)
          </label>
          <input
            id="acct-phone2"
            type="tel"
            className={styles.inputEditable}
            autoComplete="tel"
            value={form.phone_secondary}
            onChange={set("phone_secondary")}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="acct-street">
          Street address *
        </label>
        <input
          id="acct-street"
          className={styles.inputEditable}
          required
          autoComplete="street-address"
          value={form.street_address}
          onChange={set("street_address")}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="acct-line2">
          Apt / suite (optional)
        </label>
        <input
          id="acct-line2"
          className={styles.inputEditable}
          autoComplete="address-line2"
          value={form.address_line2}
          onChange={set("address_line2")}
        />
      </div>

      <div className={`${styles.fieldGrid} ${styles.fieldGridAddress}`}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-city">
            City *
          </label>
          <input
            id="acct-city"
            className={styles.inputEditable}
            required
            autoComplete="address-level2"
            value={form.city}
            onChange={set("city")}
          />
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
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-zip">
            ZIP *
          </label>
          <input
            id="acct-zip"
            className={styles.inputEditable}
            required
            autoComplete="postal-code"
            value={form.zip}
            onChange={set("zip")}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="acct-country">
          Country
        </label>
        <select
          id="acct-country"
          className={styles.inputEditable}
          value={form.country}
          onChange={set("country")}
        >
          <option value="US">United States</option>
        </select>
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
