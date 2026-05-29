"use client";

import { US_STATES } from "@/app/intake/usStates";
import {
  type IntakeDraftData,
} from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { syncProfileDemographics } from "@/lib/intake/syncProfileDemographics";
import { updateVendorOlaProfile } from "@/lib/api/vendorOla";
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
  street_address: string;
  address_line2: string;
  city: string;
  address_state: string;
  zip: string;
};

function fromDraft(d: IntakeDraftData | undefined): FormState {
  return {
    legal_first_name: d?.legal_first_name?.trim() ?? "",
    legal_last_name: d?.legal_last_name?.trim() ?? "",
    preferred_name: d?.preferred_name?.trim() ?? "",
    date_of_birth: d?.date_of_birth?.trim() ?? "",
    gender: typeof d?.gender === "string" ? d.gender : "",
    phone: d?.phone?.trim() ?? "",
    street_address: d?.street_address?.trim() ?? "",
    address_line2: d?.address_line2?.trim() ?? "",
    city: d?.city?.trim() ?? "",
    address_state: d?.service_state?.trim() || d?.address_state?.trim() || "",
    zip: d?.zip?.trim() ?? "",
  };
}

function toDraftPatch(f: FormState): IntakeDraftData {
  const state = f.address_state.trim() || undefined;
  return {
    legal_first_name: f.legal_first_name.trim() || undefined,
    legal_last_name: f.legal_last_name.trim() || undefined,
    preferred_name: f.preferred_name.trim() || undefined,
    date_of_birth: f.date_of_birth.trim() || undefined,
    gender: f.gender.trim() || undefined,
    phone: f.phone.trim() || undefined,
    street_address: f.street_address.trim() || undefined,
    address_line2: f.address_line2.trim() || undefined,
    city: f.city.trim() || undefined,
    address_state: state,
    zip: f.zip.trim() || undefined,
    country: "US",
    service_state: state,
  };
}

async function vendorResponseErrorMessage(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  if (!raw.trim()) {
    return `Service provider profile update failed (${res.status}).`;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const message =
        typeof obj.message === "string"
          ? obj.message
          : typeof obj.error === "string"
            ? obj.error
            : raw;
      return `Service provider profile update failed (${res.status}): ${message}`;
    }
  } catch {
    /* use raw response text */
  }
  return `Service provider profile update failed (${res.status}): ${raw}`;
}

function buildOlaProfilePayload(email: string, data: IntakeDraftData) {
  return {
    email,
    first_name: data.legal_first_name?.trim() || "",
    last_name: data.legal_last_name?.trim() || "",
    dob: data.date_of_birth?.trim() || "",
    gender: data.gender?.trim() || "",
    phone: data.phone?.trim() || "",
    address: {
      street1: data.street_address?.trim() || "",
      street2: data.address_line2?.trim() || "",
      city: data.city?.trim() || "",
      state: data.service_state?.trim() || data.address_state?.trim() || "",
      postalCode: data.zip?.trim() || "",
    },
  };
}

export function AccountProfileForm({
  email,
  patientId,
  olaUserGuid,
  initialStep,
  initialData,
}: {
  email: string;
  patientId: string;
  olaUserGuid: string | null;
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
      if (
        !patch.legal_first_name ||
        !patch.legal_last_name ||
        !patch.date_of_birth ||
        !patch.gender ||
        !patch.phone ||
        !patch.street_address ||
        !patch.city ||
        !patch.address_state ||
        !patch.zip
      ) {
        setError("Complete the required account details before saving.");
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

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

      if (upErr) {
        setSaving(false);
        setError(upErr.message);
        return;
      }

      const { error: syncErr } = await syncProfileDemographics(supabase, user.id, data);
      if (syncErr) {
        setSaving(false);
        setError(`Could not update profile: ${syncErr}`);
        return;
      }

      if (olaUserGuid) {
        if (!session?.access_token) {
          setSaving(false);
          setError("Sign in again to update your service provider profile.");
          return;
        }
        const olaRes = await updateVendorOlaProfile(
          session.access_token,
          olaUserGuid,
          buildOlaProfilePayload(email, data),
        );
        if (!olaRes.ok) {
          setSaving(false);
          setError(await vendorResponseErrorMessage(olaRes));
          return;
        }
      }

      setSaving(false);
      setSaved(true);
      router.refresh();
    },
    [email, form, initialData, initialStep, olaUserGuid, router],
  );

  const setField =
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

      <p className={styles.sectionLead}>Patient details</p>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-first-name">
            Legal first name *
          </label>
          <input
            id="acct-first-name"
            className={styles.inputEditable}
            required
            autoComplete="given-name"
            value={form.legal_first_name}
            onChange={setField("legal_first_name")}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-last-name">
            Legal last name *
          </label>
          <input
            id="acct-last-name"
            className={styles.inputEditable}
            required
            autoComplete="family-name"
            value={form.legal_last_name}
            onChange={setField("legal_last_name")}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-preferred-name">
            Preferred name
          </label>
          <input
            id="acct-preferred-name"
            className={styles.inputEditable}
            autoComplete="nickname"
            value={form.preferred_name}
            onChange={setField("preferred_name")}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-dob">
            Date of birth *
          </label>
          <input
            id="acct-dob"
            className={styles.inputEditable}
            type="date"
            required
            autoComplete="bday"
            value={form.date_of_birth}
            onChange={setField("date_of_birth")}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-gender">
            Sex assigned at birth *
          </label>
          <select
            id="acct-gender"
            className={styles.inputEditable}
            required
            value={form.gender}
            onChange={setField("gender")}
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-phone">
            Phone *
          </label>
          <input
            id="acct-phone"
            className={styles.inputEditable}
            required
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={setField("phone")}
          />
        </div>
      </div>

      <p className={styles.sectionLead}>Shipping address</p>

      <div className={`${styles.fieldGrid} ${styles.fieldGridAddressFull}`}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-street">
            Street address *
          </label>
          <input
            id="acct-street"
            className={styles.inputEditable}
            required
            autoComplete="address-line1"
            value={form.street_address}
            onChange={setField("street_address")}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acct-line2">
            Apt, suite, etc.
          </label>
          <input
            id="acct-line2"
            className={styles.inputEditable}
            autoComplete="address-line2"
            value={form.address_line2}
            onChange={setField("address_line2")}
          />
        </div>
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
            onChange={setField("city")}
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
            onChange={setField("address_state")}
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
            inputMode="numeric"
            autoComplete="postal-code"
            value={form.zip}
            onChange={setField("zip")}
          />
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
