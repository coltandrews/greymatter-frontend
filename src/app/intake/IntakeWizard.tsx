"use client";

import { createClient } from "@/lib/supabase/client";
import {
  type IntakeDraftData,
} from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import {
  PRE_AUTH_INTAKE_STORAGE_KEY,
  parsePreAuthIntake,
} from "@/lib/intake/preAuthIntake";
import { syncProfileDemographics } from "@/lib/intake/syncProfileDemographics";
import { US_STATES } from "@/app/intake/usStates";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UiStep =
  | "basic_identity"
  | "basic_demographics"
  | "eligibility"
  | "service_state"
  | "done";

function legalNameComplete(d: IntakeDraftData): boolean {
  return Boolean(d.legal_first_name?.trim() && d.legal_last_name?.trim());
}

function demographicsDetailsComplete(d: IntakeDraftData): boolean {
  return Boolean(d.date_of_birth?.trim() && d.gender?.trim());
}

function resolveUiStep(
  row: { step: string; data: unknown } | null,
  merged: IntakeDraftData,
): UiStep {
  if (!row) {
    return "basic_identity";
  }
  if (row.step === "paused_before_scheduling") {
    return "done";
  }
  if (!legalNameComplete(merged)) {
    return "basic_identity";
  }
  if (!demographicsDetailsComplete(merged)) {
    return "basic_demographics";
  }
  if (!(merged.service_state?.trim() || merged.address_state?.trim())) {
    return "service_state";
  }
  if (typeof merged.for_self !== "boolean") {
    return "eligibility";
  }
  return "eligibility";
}

const EMPTY_BASIC: Omit<
  IntakeDraftData,
  "for_self" | "preferred_name" | "service_state"
> = {
  legal_first_name: "",
  legal_last_name: "",
  date_of_birth: "",
  gender: "",
  phone: "",
  phone_secondary: "",
  street_address: "",
  address_line2: "",
  city: "",
  address_state: "",
  zip: "",
  country: "US",
};

async function ensureSubmission(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: rows, error: selErr } = await supabase
    .from("submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .limit(1);

  if (selErr) {
    throw new Error(selErr.message);
  }
  if (rows && rows.length > 0) {
    return;
  }

  const { error: insErr } = await supabase.from("submissions").insert({
    user_id: userId,
    status: "in_progress",
  });
  if (insErr) {
    throw new Error(insErr.message);
  }
}

function draftFromBasicState(b: typeof EMPTY_BASIC): IntakeDraftData {
  return {
    legal_first_name: b.legal_first_name?.trim() || undefined,
    legal_last_name: b.legal_last_name?.trim() || undefined,
    date_of_birth: b.date_of_birth?.trim() || undefined,
    gender: b.gender?.trim() || undefined,
    phone: b.phone?.trim() || undefined,
    phone_secondary: b.phone_secondary?.trim() || undefined,
    street_address: b.street_address?.trim() || undefined,
    address_line2: b.address_line2?.trim() || undefined,
    city: b.city?.trim() || undefined,
    address_state: b.address_state?.trim() || undefined,
    zip: b.zip?.trim() || undefined,
    country: b.country?.trim() || "US",
  };
}

function loadBasicFromDraft(d: IntakeDraftData | undefined): typeof EMPTY_BASIC {
  if (!d) {
    return { ...EMPTY_BASIC };
  }
  return {
    legal_first_name: d.legal_first_name ?? "",
    legal_last_name: d.legal_last_name ?? "",
    date_of_birth: d.date_of_birth ?? "",
    gender: typeof d.gender === "string" ? d.gender : "",
    phone: d.phone ?? "",
    phone_secondary: d.phone_secondary ?? "",
    street_address: d.street_address ?? "",
    address_line2: d.address_line2 ?? "",
    city: d.city ?? "",
    address_state: d.address_state ?? "",
    zip: d.zip ?? "",
    country: d.country?.trim() || "US",
  };
}

export function IntakeWizard() {
  const router = useRouter();
  const [uiStep, setUiStep] = useState<UiStep>("basic_identity");
  const [basic, setBasic] = useState(loadBasicFromDraft(undefined));
  const [forSelf, setForSelf] = useState<boolean | null>(null);
  const [serviceState, setServiceState] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDraft = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data: row, error: qErr }, { data: profileRow }] = await Promise.all([
      supabase
        .from("intake_drafts")
        .select("step, data")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("profiles").select("demographics").eq("id", user.id).maybeSingle(),
    ]);

    if (qErr) {
      setError(qErr.message);
      setLoading(false);
      return;
    }

    const preAuthIntake = !row
      ? parsePreAuthIntake(window.localStorage.getItem(PRE_AUTH_INTAKE_STORAGE_KEY))
      : null;

    if (preAuthIntake) {
      const { error: upErr } = await supabase.from("intake_drafts").upsert(
        {
          user_id: user.id,
          step: "paused_before_scheduling",
          data: preAuthIntake,
        },
        { onConflict: "user_id" },
      );
      if (upErr) {
        setError(upErr.message);
        setLoading(false);
        return;
      }

      const { error: syncErr } = await syncProfileDemographics(
        supabase,
        user.id,
        preAuthIntake,
      );
      if (syncErr) {
        setError(`Could not save profile: ${syncErr}`);
        setLoading(false);
        return;
      }

      try {
        await ensureSubmission(supabase, user.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start submission.");
        setLoading(false);
        return;
      }

      window.localStorage.removeItem(PRE_AUTH_INTAKE_STORAGE_KEY);
      setLoading(false);
      router.replace("/hub");
      return;
    }

    const merged = mergeIntakeAndProfileDemographics(
      row?.data as IntakeDraftData | undefined,
      profileRow?.demographics as IntakeDraftData | undefined,
    );
    setBasic(loadBasicFromDraft(merged));
    if (typeof merged.for_self === "boolean") {
      setForSelf(merged.for_self);
    }
    const svc = merged.service_state?.trim() ?? "";
    const addrSt = merged.address_state?.trim() ?? "";
    setServiceState(svc || addrSt);

    if (row) {
      try {
        await ensureSubmission(supabase, user.id);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not sync submission record.",
        );
      }
    }

    const resolved = resolveUiStep(row ?? null, merged);
    if (resolved === "done") {
      setLoading(false);
      router.replace("/hub");
      return;
    }
    setUiStep(resolved);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  async function saveBasicIdentity(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const asDraft = draftFromBasicState({ ...EMPTY_BASIC, ...basic });

    setSaving(true);
    setSaved(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }

    const [{ data: existing }, { data: prof }] = await Promise.all([
      supabase.from("intake_drafts").select("data").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("demographics").eq("id", user.id).maybeSingle(),
    ]);
    const prior = mergeIntakeAndProfileDemographics(
      existing?.data as IntakeDraftData | undefined,
      prof?.demographics as IntakeDraftData | undefined,
    );

    const data: IntakeDraftData = { ...prior, ...asDraft };
    if (!legalNameComplete(data)) {
      setSaving(false);
      setError("Please complete your legal first and last name.");
      return;
    }

    const { error: upErr } = await supabase.from("intake_drafts").upsert(
      {
        user_id: user.id,
        step: "basic_demographics",
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
      setError(`Could not save profile: ${syncErr}`);
      return;
    }

    try {
      await ensureSubmission(supabase, user.id);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not start submission.");
      return;
    }

    setSaving(false);
    setUiStep("basic_demographics");
  }

  async function saveBasicDemographics(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const asDraft = draftFromBasicState({ ...EMPTY_BASIC, ...basic });

    setSaving(true);
    setSaved(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }

    const [{ data: existing }, { data: prof }] = await Promise.all([
      supabase.from("intake_drafts").select("data").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("demographics").eq("id", user.id).maybeSingle(),
    ]);
    const prior = mergeIntakeAndProfileDemographics(
      existing?.data as IntakeDraftData | undefined,
      prof?.demographics as IntakeDraftData | undefined,
    );

    const data: IntakeDraftData = { ...prior, ...asDraft };
    if (!demographicsDetailsComplete(data)) {
      setSaving(false);
      setError("Please complete date of birth and gender.");
      return;
    }

    const { error: upErr } = await supabase.from("intake_drafts").upsert(
      {
        user_id: user.id,
        step: "service_state",
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
      setError(`Could not save profile: ${syncErr}`);
      return;
    }

    try {
      await ensureSubmission(supabase, user.id);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not start submission.");
      return;
    }

    setSaving(false);
    setUiStep("service_state");
  }

  async function backToIdentity() {
    setError(null);
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

    const [{ data: existing }, { data: prof }] = await Promise.all([
      supabase.from("intake_drafts").select("data").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("demographics").eq("id", user.id).maybeSingle(),
    ]);
    const prior = mergeIntakeAndProfileDemographics(
      existing?.data as IntakeDraftData | undefined,
      prof?.demographics as IntakeDraftData | undefined,
    );
    const data: IntakeDraftData = { ...prior, ...draftFromBasicState(basic) };

    const { error: upErr } = await supabase.from("intake_drafts").upsert(
      {
        user_id: user.id,
        step: "basic_identity",
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
      setError(`Could not save profile: ${syncErr}`);
      return;
    }

    setUiStep("basic_identity");
  }

  async function saveEligibility(e: React.FormEvent) {
    e.preventDefault();
    if (forSelf === null) {
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }

    const [{ data: existing }, { data: prof }] = await Promise.all([
      supabase.from("intake_drafts").select("data").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("demographics").eq("id", user.id).maybeSingle(),
    ]);
    const prior = mergeIntakeAndProfileDemographics(
      existing?.data as IntakeDraftData | undefined,
      prof?.demographics as IntakeDraftData | undefined,
    );
    const asDraft = draftFromBasicState(basic);
    const st = serviceState || prior.service_state || prior.address_state || "";
    const data: IntakeDraftData = {
      ...prior,
      ...asDraft,
      for_self: forSelf,
      ...(st ? { service_state: st, address_state: st } : {}),
    };

    const { error: upErr } = await supabase.from("intake_drafts").upsert(
      {
        user_id: user.id,
        step: "paused_before_scheduling",
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
      setError(`Could not save profile: ${syncErr}`);
      return;
    }

    try {
      await ensureSubmission(supabase, user.id);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not start submission.");
      return;
    }

    router.push("/hub");
    router.refresh();
  }

  async function saveServiceState(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceState) {
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }

    try {
      await ensureSubmission(supabase, user.id);
    } catch (err) {
      setSaving(false);
      setError(
        err instanceof Error ? err.message : "Could not sync submission record.",
      );
      return;
    }

    const [{ data: existing }, { data: prof }] = await Promise.all([
      supabase.from("intake_drafts").select("data").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("demographics").eq("id", user.id).maybeSingle(),
    ]);
    const prior = mergeIntakeAndProfileDemographics(
      existing?.data as IntakeDraftData | undefined,
      prof?.demographics as IntakeDraftData | undefined,
    );
    const asDraft = draftFromBasicState(basic);
    const data: IntakeDraftData = {
      ...prior,
      ...asDraft,
      ...(forSelf !== null ? { for_self: forSelf } : {}),
      address_state: serviceState,
      service_state: serviceState,
    };

    const { error: upErr } = await supabase.from("intake_drafts").upsert(
      {
        user_id: user.id,
        step: "eligibility",
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
      setError(`Could not save profile: ${syncErr}`);
      return;
    }

    setUiStep("eligibility");
  }

  if (loading) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading…</p>
    );
  }

  const btnBase = {
    padding: "12px 18px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer" as const,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#172033",
  };

  const formStyle: CSSProperties = {
    display: "grid",
    gap: 22,
  };

  const stepStyle: CSSProperties = {
    margin: 0,
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
    letterSpacing: 0,
  };

  const introStyle: CSSProperties = {
    margin: 0,
    maxWidth: 680,
    fontSize: 15,
    lineHeight: 1.55,
    color: "#344256",
  };

  const fieldGroupStyle: CSSProperties = {
    display: "grid",
    gap: 14,
    padding: "18px 0 4px",
    borderTop: "1px solid #eef2f7",
  };

  const groupTitleStyle: CSSProperties = {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
  };

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  };

  const labelStyle: CSSProperties = {
    display: "grid" as const,
    gap: 7,
    fontSize: 14,
    fontWeight: 600,
    color: "#172033",
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 13px",
    borderRadius: 8,
    border: "1px solid #d8e0ec",
    fontSize: 16,
    color: "#172033",
    background: "#fff",
  };

  const primaryButtonStyle: CSSProperties = {
    padding: "12px 18px",
    borderRadius: 8,
    border: "none",
    background: saving ? "#94a3b8" : "#172033",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: saving ? "not-allowed" : "pointer",
  };

  const secondaryButtonStyle: CSSProperties = {
    padding: "12px 18px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#475569",
    fontSize: 16,
    fontWeight: 700,
    cursor: saving ? "not-allowed" : "pointer",
  };

  const actionsStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    justifyContent: "flex-end",
  };

  const maxDob = new Date().toISOString().slice(0, 10);
  const minDob = new Date(new Date().getFullYear() - 120, 0, 1)
    .toISOString()
    .slice(0, 10);

  if (uiStep === "basic_identity") {
    return (
      <form onSubmit={saveBasicIdentity} style={formStyle}>
        <p style={stepStyle}>Step 1 of 4 - Name</p>
        <p style={introStyle}>
          Legal name for your chart and eligibility.
        </p>

        <div style={fieldGroupStyle}>
          <p style={groupTitleStyle}>Legal name</p>
          <div style={gridStyle}>
            <label style={labelStyle}>
              First name *
              <input
                required
                autoComplete="given-name"
                value={basic.legal_first_name}
                onChange={(e) => {
                  setBasic((p) => ({ ...p, legal_first_name: e.target.value }));
                  setSaved(false);
                }}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Last name *
              <input
                required
                autoComplete="family-name"
                value={basic.legal_last_name}
                onChange={(e) => {
                  setBasic((p) => ({ ...p, legal_last_name: e.target.value }));
                  setSaved(false);
                }}
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        {error ? (
          <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          style={{ ...primaryButtonStyle, justifySelf: "end" }}
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    );
  }

  if (uiStep === "basic_demographics") {
    return (
      <form onSubmit={saveBasicDemographics} style={formStyle}>
        <p style={stepStyle}>Step 2 of 4 - Details</p>
        <p style={introStyle}>
          Date of birth and gender for eligibility.
        </p>

        <div style={fieldGroupStyle}>
          <p style={groupTitleStyle}>Date of birth &amp; gender</p>
          <div style={gridStyle}>
            <label style={labelStyle}>
              Date of birth *
              <input
                type="date"
                required
                min={minDob}
                max={maxDob}
                value={basic.date_of_birth}
                onChange={(e) => {
                  setBasic((p) => ({ ...p, date_of_birth: e.target.value }));
                  setSaved(false);
                }}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Gender *
              <select
                required
                value={basic.gender}
                onChange={(e) => {
                  setBasic((p) => ({ ...p, gender: e.target.value }));
                  setSaved(false);
                }}
                style={inputStyle}
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not">Prefer not to say</option>
              </select>
            </label>
          </div>
        </div>

        {error ? (
          <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
            {error}
          </p>
        ) : null}
        <div style={actionsStyle}>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              void backToIdentity();
            }}
            style={secondaryButtonStyle}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={saving}
            style={primaryButtonStyle}
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    );
  }

  if (uiStep === "service_state") {
    return (
      <form onSubmit={saveServiceState} style={formStyle}>
        <p style={stepStyle}>Step 3 of 4 - Care location</p>
        <p style={introStyle}>
          State for telehealth eligibility and scheduling.
        </p>
        <div style={fieldGroupStyle}>
          <label style={{ ...labelStyle, maxWidth: 360 }}>
            State for care &amp; scheduling *
            <select
              required
              value={serviceState}
              onChange={(e) => {
                setServiceState(e.target.value);
                setSaved(false);
              }}
              style={inputStyle}
            >
              <option value="">Select...</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? (
          <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
            {error}
          </p>
        ) : null}
        {saved ? (
          <p style={{ margin: 0, color: "#15803d", fontSize: 14 }}>Saved.</p>
        ) : null}
        <div style={actionsStyle}>
          <button
            type="button"
            disabled={saving}
            onClick={() => setUiStep("basic_demographics")}
            style={secondaryButtonStyle}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!serviceState || saving}
            style={{
              ...primaryButtonStyle,
              background: !serviceState || saving ? "#94a3b8" : "#172033",
              cursor: !serviceState || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={saveEligibility} style={formStyle}>
      <p style={stepStyle}>Step 4 of 4 - Eligibility</p>
      <p style={introStyle}>
        Are you providing this health and eligibility information for yourself?
      </p>
      <div style={fieldGroupStyle}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setForSelf(true);
              setSaved(false);
            }}
            style={{
              ...btnBase,
              minWidth: 110,
              borderColor: forSelf === true ? "#172033" : "#cbd5e1",
              background: forSelf === true ? "#172033" : "#fff",
              color: forSelf === true ? "#fff" : "#172033",
            }}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => {
              setForSelf(false);
              setSaved(false);
            }}
            style={{
              ...btnBase,
              minWidth: 110,
              borderColor: forSelf === false ? "#172033" : "#cbd5e1",
              background: forSelf === false ? "#172033" : "#fff",
              color: forSelf === false ? "#fff" : "#172033",
            }}
          >
            No
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
          {error}
        </p>
      ) : null}
      <div style={actionsStyle}>
        <button
          type="button"
          disabled={saving}
          onClick={() => setUiStep("service_state")}
          style={secondaryButtonStyle}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={forSelf === null || saving}
          style={{
            ...primaryButtonStyle,
            background: forSelf === null || saving ? "#94a3b8" : "#172033",
            cursor: forSelf === null || saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
